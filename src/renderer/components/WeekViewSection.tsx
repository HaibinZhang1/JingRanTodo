import React, { useState, useMemo, useEffect } from 'react'
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks, isWeekend as dateFnsIsWeekend } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'

import { Task } from '../store/tasksSlice'
import { GlassPanel } from './GlassPanel'
import { useAppDispatch, useAppSelector } from '../hooks/useRedux'
import { createTask, updateTask, deleteTask } from '../store/tasksSlice'
import { RootState } from '../store'
import { saveSetting } from '../store/settingsSlice'
import { CalendarContextMenu } from './CalendarContextMenu'
import { TaskPreviewCard } from './TaskPreviewCard'
import { getHolidayInfo, preloadHolidayData } from '../services/holidayService'
import { CopyFormatSettingsModal } from './CopyFormatSettingsModal'
import { toChineseNum, getPriorityColor } from '../utils/formatUtils'

// getPriorityColor 已从 utils/formatUtils 导入

// Draggable Task Item for Week View
const DraggableWeekTask: React.FC<{
    task: Task;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ task, onClick, onContextMenu }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
        data: { task }
    })

    const isCompleted = task.status === 'done'
    const subtaskCount = task.subtasks?.length || 0
    const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => { e.stopPropagation(); onClick(e) }}
            onContextMenu={onContextMenu}
            className={`relative mb-1 px-2 py-1 pl-3 rounded-lg border border-gray-100 text-xs shadow-sm cursor-grab hover:scale-[1.02] transition-transform truncate ${isCompleted ? 'line-through text-gray-400 bg-gray-50/80' : 'bg-white/80 text-gray-700'} ${isDragging ? 'opacity-50' : ''}`}
        >
            {/* Left priority color bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getPriorityColor(task.priority)}`} />
            <div className="flex items-center justify-between gap-1">
                <span className="truncate">{task.title}</span>
                {subtaskCount > 0 && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">
                        {completedSubtasks}/{subtaskCount}
                    </span>
                )}
            </div>
        </div>
    )
}


// Droppable AM/PM Container for Week View
const DroppableWeekCell: React.FC<{
    date: string;
    period: 'am' | 'pm';
    children: React.ReactNode;
    className?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ date, period, children, className, onContextMenu }) => {
    const droppableId = `week-${period}-${date}`
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { date, period }
    })

    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/50' : ''}`} onContextMenu={onContextMenu}>
            {children}
        </div>
    )
}

interface WeekViewSectionProps {
    tasks: Task[]
    onTaskClick?: (task: Task) => void
    onOpenTaskDetail?: (task: Task) => void
    className?: string
    isDark?: boolean
}

export const WeekViewSection: React.FC<WeekViewSectionProps> = ({ tasks, onTaskClick, onOpenTaskDetail, className, isDark = false }) => {
    const dispatch = useAppDispatch()
    const [currentDate, setCurrentDate] = useState(new Date())
    const isCollapsed = useAppSelector((state: RootState) => state.settings.weekViewCollapsed)
    const [holidayLoaded, setHolidayLoaded] = useState(false)
    const [activeTask, setActiveTask] = useState<Task | null>(null)

    // 使用 PointerSensor 配合位移激活，匹配日历视图和看板的拖拽响应速度
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    })
    const sensors = useSensors(pointerSensor)


    // 加载节假日数据 & 检查浮窗状态
    useEffect(() => {
        const loadData = async () => {
            try {
                await preloadHolidayData([2024, 2025, 2026])
                setHolidayLoaded(true)


            } catch (error) {
                console.error('[WeekViewSection] Failed to load data:', error)
            }
        }
        loadData()
    }, [])

    // 拖放处理
    const handleDragStart = (event: any) => {
        const task = event.active.data.current?.task
        if (task) setActiveTask(task)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveTask(null)

        const { active, over } = event
        if (!over) return

        const task = active.data.current?.task as Task
        if (!task) return

        const dropData = over.data.current as { date: string; period: 'am' | 'pm' } | undefined
        if (!dropData) return

        const { date: newDate, period } = dropData

        // 确定新的 reminder_time
        let newReminderTime = task.reminder_time
        const originalIsAM = task.reminder_time ? new Date(task.reminder_time).getHours() < 12 : true

        if (period && period !== (originalIsAM ? 'am' : 'pm')) {
            if (originalIsAM && period === 'pm') {
                newReminderTime = `${newDate}T14:00:00`
            } else if (!originalIsAM && period === 'am') {
                newReminderTime = `${newDate}T08:00:00`
            }
        } else if (task.due_date !== newDate && task.reminder_time) {
            const timePart = task.reminder_time.split('T')[1] || (originalIsAM ? '08:00:00' : '14:00:00')
            newReminderTime = `${newDate}T${timePart}`
        } else if (task.due_date !== newDate && !task.reminder_time) {
            newReminderTime = `${newDate}T${period === 'am' ? '08:00:00' : '14:00:00'}`
        }

        // 更新任务
        if (task.due_date !== newDate || task.reminder_time !== newReminderTime) {
            // 只比较日期部分，判断是否为单日任务
            const taskStartDateOnly = task.start_date?.split('T')[0]
            const taskDueDateOnly = task.due_date?.split('T')[0]
            const isOriginalSingleDayTask = !task.start_date || taskStartDateOnly === taskDueDateOnly
            const newStartDate = isOriginalSingleDayTask ? newDate : task.start_date

            dispatch(updateTask({
                ...task,
                start_date: newStartDate,
                due_date: newDate,
                reminder_time: newReminderTime,
                panel_id: null
            }))
        }
    }



    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        date: string
        period?: 'am' | 'pm'
        task?: Task | null
        tasks: Task[]
    } | null>(null)

    // 预览卡片状态
    const [previewTask, setPreviewTask] = useState<{ task: Task; position: { x: number; y: number } } | null>(null)

    // 复制格式设置状态
    const [copyFormatSettings, setCopyFormatSettings] = useState<{
        copyFormat: 'text' | 'json' | 'markdown'
        copyTemplateTask: string
        copyTemplateSubtask: string
    }>({
        copyFormat: 'text',
        copyTemplateTask: '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
        copyTemplateSubtask: '    {{index}}.{{title}}\n        {{description}}'
    })
    const [showFormatSettings, setShowFormatSettings] = useState(false)

    // 处理任务点击 - 显示预览卡片
    const handleTaskClick = (task: Task, e: React.MouseEvent) => {
        e.stopPropagation()
        setPreviewTask({
            task,
            position: { x: e.clientX + 10, y: e.clientY + 10 }
        })
    }

    // 导航函数
    const navigate = (direction: 'prev' | 'next') => {
        setCurrentDate(d => direction === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1))
    }
    const resetToday = () => setCurrentDate(new Date())

    // 计算本周日期范围 (周一至周日)
    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 }) // 周一作为一周开始
        return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }, [currentDate])

    // 判断是否为多日任务 - 只比较日期部分，忽略时间
    const isMultiDayTask = (task: Task): boolean => {
        if (!task.start_date || !task.due_date) return false
        // 提取日期部分（YYYY-MM-DD），忽略时间部分
        const startDateOnly = task.start_date.split('T')[0]
        const dueDateOnly = task.due_date.split('T')[0]
        return startDateOnly !== dueDateOnly
    }

    // 获取当前周内的跨天任务
    const multiDayTasks = useMemo(() => {
        const weekStart = format(weekDays[0], 'yyyy-MM-dd')
        const weekEnd = format(weekDays[6], 'yyyy-MM-dd')
        return tasks.filter(task => {
            if (!isMultiDayTask(task)) return false
            // 提取日期部分进行比较
            const taskStart = task.start_date!.split('T')[0]
            const taskEnd = task.due_date!.split('T')[0]
            return taskStart <= weekEnd && taskEnd >= weekStart
        })
    }, [tasks, weekDays])

    // 计算本周已完成任务数
    const weekCompletedTasks = useMemo(() => {
        const weekStart = format(weekDays[0], 'yyyy-MM-dd')
        const weekEnd = format(weekDays[6], 'yyyy-MM-dd')
        return tasks.filter(t => {
            if (t.status !== 'done' || !t.due_date) return false
            // 提取日期部分进行比较
            const dueDateOnly = t.due_date.split('T')[0]
            return dueDateOnly >= weekStart && dueDateOnly <= weekEnd
        })
    }, [tasks, weekDays])

    // 计算任务在当前周的可见范围
    const getTaskVisibleRange = (task: Task): { startCol: number, endCol: number } => {
        const weekStart = weekDays[0]
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        const weekEndStr = format(weekDays[6], 'yyyy-MM-dd')
        // 提取日期部分，避免时间影响计算
        const taskStartStr = task.start_date!.split('T')[0]
        const taskEndStr = task.due_date!.split('T')[0]

        let startCol = 0
        if (taskStartStr > weekStartStr) {
            // 使用日期字符串直接计算天数差，避免时区问题
            const taskStartDate = new Date(taskStartStr + 'T00:00:00')
            const weekStartDate = new Date(weekStartStr + 'T00:00:00')
            const diffDays = Math.round((taskStartDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
            startCol = Math.max(0, diffDays)
        }

        let endCol = 6
        if (taskEndStr < weekEndStr) {
            const taskEndDate = new Date(taskEndStr + 'T00:00:00')
            const weekStartDate = new Date(weekStartStr + 'T00:00:00')
            const diffDays = Math.round((taskEndDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
            endCol = Math.min(6, diffDays)
        }

        return { startCol, endCol }
    }

    // 组件内部仍然保留一个局部 getPriorityColor，用于绘制状态这是设计的决定
    // 注：外部的 getPriorityColor 已从 utils/formatUtils 导入

    // 将任务分配到对应的天和时段 (AM/PM) - 排除跨天任务
    const weekTaskMap = useMemo(() => {
        const map = new Map<string, { am: Task[], pm: Task[] }>()

        // 初始化每一天
        weekDays.forEach(date => {
            map.set(format(date, 'yyyy-MM-dd'), { am: [], pm: [] })
        })

        tasks.forEach(task => {
            if (!task.due_date) return
            // 跨天任务不在普通单元格显示
            if (isMultiDayTask(task)) return

            // 提取日期部分作为 key
            const dueDateOnly = task.due_date.split('T')[0]
            const dayData = map.get(dueDateOnly)
            if (dayData) {
                let isAm = true
                if (task.reminder_time) {
                    // 修复：正确解析 ISO 时间字符串
                    if (task.reminder_time.includes('T')) {
                        const timePart = task.reminder_time.split('T')[1]
                        const hour = parseInt(timePart.split(':')[0], 10)
                        if (!isNaN(hour) && hour >= 12) {
                            isAm = false
                        }
                    } else {
                        // 兼容可能得非标准格式
                        const hour = parseInt(task.reminder_time.split(':')[0], 10)
                        if (!isNaN(hour) && hour >= 12) {
                            isAm = false
                        }
                    }
                } else if (task.created_at) {
                    const createdDate = new Date(task.created_at)
                    if (createdDate.getHours() >= 12) isAm = false
                }

                if (isAm) {
                    dayData.am.push(task)
                } else {
                    dayData.pm.push(task)
                }
            }
        })

        return map
    }, [tasks, weekDays])

    // 处理右键菜单
    const handleContextMenu = (e: React.MouseEvent, date: string, period?: 'am' | 'pm', task?: Task, cellTasks?: Task[]) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            date,
            period,
            task: task || null,
            tasks: cellTasks || []
        })
    }

    const closeContextMenu = () => setContextMenu(null)

    const handleCreateTask = (date: string, period?: 'am' | 'pm') => {
        // 如果有 onOpenTaskDetail 回调，打开创建弹窗而不是直接创建
        if (onOpenTaskDetail) {
            const hour = period === 'pm' ? 14 : 8
            const created_at = `${date}T${String(hour).padStart(2, '0')}:00:00`
            onOpenTaskDetail({ due_date: date, created_at } as Task)
        } else {
            // 无回调时的fallback：直接创建任务
            const hour = period === 'pm' ? 14 : 9
            dispatch(createTask({
                title: '新任务',
                status: 'todo',
                priority: 'medium',
                due_date: date,
                created_at: `${date}T${String(hour).padStart(2, '0')}:00:00`,
                reminder_time: `${date}T${String(hour).padStart(2, '0')}:00:00`,
                panel_id: null
            }))
        }
    }

    const handleToggleStatus = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId)
        if (task) {
            dispatch(updateTask({
                ...task,
                status: task.status === 'done' ? 'todo' : 'done',
                completed_at: task.status === 'done' ? null : new Date().toISOString(),
                is_pinned: false
            }))
        }
    }

    const handleDeleteTask = (taskId: string) => {
        dispatch(deleteTask(taskId))
    }

    const handleEditTask = (task: Task) => {
        onTaskClick?.(task)
    }

    // 复制本周已完成任务
    const handleCopyWeekCompleted = () => {
        if (weekCompletedTasks.length === 0) return

        // toChineseNum 已从 utils/formatUtils 导入

        let text = ''
        const { copyFormat, copyTemplateTask, copyTemplateSubtask } = copyFormatSettings

        if (copyFormat === 'json') {
            text = JSON.stringify(weekCompletedTasks.map(t => ({
                title: t.title,
                description: t.description,
                subtasks: t.subtasks?.map(s => ({ title: s.title, description: s.description, completed: s.completed }))
            })), null, 2)
        } else if (copyFormat === 'markdown') {
            text = weekCompletedTasks.map(task => {
                let str = `## ${task.title}\n`
                if (task.description) str += `${task.description}\n`
                if (task.subtasks && task.subtasks.length > 0) {
                    str += '\n### 子任务\n'
                    task.subtasks.forEach(st => {
                        str += `- [${st.completed ? 'x' : ' '}] ${st.title}\n`
                    })
                }
                return str
            }).join('\n---\n\n')
        } else {
            text = weekCompletedTasks.map((task, idx) => {
                let subtasksText = ''
                if (task.subtasks && task.subtasks.length > 0) {
                    subtasksText = task.subtasks.map((st, sIdx) => {
                        let stStr = copyTemplateSubtask
                            .replace(/{{index}}/g, (sIdx + 1).toString())
                            .replace(/{{title}}/g, st.title)
                            .replace(/{{description}}/g, st.description || '___EMPTY_FIELD___')

                        return stStr.split('\n')
                            .filter(line => line.trim() !== '___EMPTY_FIELD___')
                            .join('\n')
                            .replace(/___EMPTY_FIELD___/g, '')
                    }).join('\n')
                }

                let taskStr = copyTemplateTask
                    .replace(/{{chinese_index}}/g, toChineseNum(idx + 1))
                    .replace(/{{index}}/g, (idx + 1).toString())
                    .replace(/{{title}}/g, task.title)
                    .replace(/{{description}}/g, task.description || '___EMPTY_FIELD___')
                    .replace(/{{subtasks}}/g, subtasksText || '___EMPTY_FIELD___')

                taskStr = taskStr.split('\n')
                    .filter(line => line.trim() !== '___EMPTY_FIELD___')
                    .join('\n')
                    .replace(/___EMPTY_FIELD___/g, '')

                return taskStr
            }).join('\n')
        }

        navigator.clipboard.writeText(text).then(() => {
            // Clipboard copy succeeded
        }).catch(err => {
            console.error('Failed to copy:', err)
        })
    }

    // 周范围标题
    const weekRangeTitle = useMemo(() => {
        const start = weekDays[0]
        const end = weekDays[6]
        if (start.getMonth() === end.getMonth()) {
            return `${format(start, 'M月d日')} - ${format(end, 'd日')}`
        }
        return `${format(start, 'M月d日')} - ${format(end, 'M月d日')}`
    }, [weekDays])

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} autoScroll={false}>
            <GlassPanel isDark={isDark} variant="panel" className={`flex flex-col transition-all duration-300 overflow-hidden ${className}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100 select-none">
                            <Calendar size={16} className="text-blue-600 dark:text-blue-400" />

                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-1">
                                {weekRangeTitle}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {/* Navigation - moved to right side */}
                        <div className="flex items-center bg-gray-100/80 dark:bg-gray-700/50 rounded-lg p-0.5 mr-1 border border-gray-200/50 dark:border-gray-600/30">
                            <button
                                onClick={() => navigate('prev')}
                                className="px-1.5 py-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 transition-colors"
                                title="上周"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={resetToday}
                                className={`px-1.5 py-1 hover:bg-white dark:hover:bg-gray-600 rounded transition-colors ${isSameDay(currentDate, new Date()) ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                                title="回到今天"
                            >
                                <RotateCcw size={12} />
                            </button>
                            <button
                                onClick={() => navigate('next')}
                                className="px-1.5 py-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 transition-colors"
                                title="下周"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        {/* Collapse Button */}
                        <button
                            onClick={() => dispatch(saveSetting({ key: 'weekViewCollapsed', value: !isCollapsed }))}
                            className="p-1.5 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                            title={isCollapsed ? '展开' : '收起'}
                        >
                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                    </div>
                </div>

                {/* Content */}
                {!isCollapsed && (
                    <div className="flex-1 flex min-h-[300px] max-h-[300px] overflow-hidden select-none rounded-b-xl">
                        {/* Time Indicator Sidebar */}
                        <div className="w-8 shrink-0 flex flex-col border-r border-gray-200/60 dark:border-white/10 text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                            {/* Spacer to match Date Title height */}
                            <div className="h-8 w-full border-b border-gray-200/60 dark:border-white/10" />
                            {/* Gantt Spacer - if there are multi-day tasks */}
                            {multiDayTasks.length > 0 && (
                                <div className="w-full border-b border-gray-200/60 dark:border-white/10 flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/40" style={{ minHeight: Math.min(multiDayTasks.length * 20 + 8, 68), maxHeight: 68 }}>
                                    <span className="[writing-mode:vertical-rl] text-[9px]">持续</span>
                                </div>
                            )}

                            <div className="flex-1 flex items-center justify-center border-b border-gray-200/60 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/40">
                                <span className="[writing-mode:vertical-rl] tracking-[1.5em]">上午</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/40">
                                <span className="[writing-mode:vertical-rl] tracking-[1.5em]">下午</span>
                            </div>
                        </div>

                        {/* Main grid area */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Header Row */}
                            <div className="flex border-b border-gray-200/60 dark:border-white/10">
                                {weekDays.map((date, index) => {
                                    const dateStr = format(date, 'yyyy-MM-dd')
                                    const isCurrentDay = isToday(date)
                                    const holiday = getHolidayInfo(dateStr)
                                    const isHolidayType = holiday.type === 2
                                    const isWorkday = holiday.type === 3
                                    const isWeekendType = holiday.type === 1

                                    let headerBg = ''
                                    let headerTextColor = 'text-gray-600 dark:text-gray-400'
                                    let dateTextColor = 'text-gray-700 dark:text-gray-300'

                                    if (isCurrentDay) {
                                        headerBg = 'bg-blue-100/80 dark:bg-blue-900/50'
                                        headerTextColor = 'text-blue-600 dark:text-blue-400'
                                        dateTextColor = 'text-blue-600 dark:text-blue-400'
                                    } else if (isHolidayType) {
                                        headerBg = 'bg-red-100 dark:bg-red-900/50'
                                        headerTextColor = 'text-red-500 dark:text-red-400'
                                        dateTextColor = 'text-red-600 dark:text-red-400'
                                    } else if (isWorkday) {
                                        headerBg = 'bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600'
                                        headerTextColor = 'text-yellow-600 dark:text-yellow-400'
                                        dateTextColor = 'text-yellow-700 dark:text-yellow-300'
                                    } else if (isWeekendType) {
                                        headerBg = 'bg-gray-100 dark:bg-gray-700/50'
                                        headerTextColor = 'text-gray-400 dark:text-gray-500'
                                        dateTextColor = 'text-gray-500 dark:text-gray-400'
                                    }

                                    return (
                                        <div
                                            key={dateStr}
                                            className="flex-1 h-8 border-r border-gray-200/60 dark:border-white/10 last:border-r-0 py-0.5"
                                        >
                                            <div className={`mx-0.5 rounded-lg flex items-center justify-between px-1.5 h-full ${headerBg}`}>
                                                <span className={`text-[10px] min-w-[16px] ${dateTextColor}`}>
                                                    {format(date, 'd')}
                                                </span>
                                                <span className={`text-xs font-bold ${headerTextColor}`}>
                                                    周{['一', '二', '三', '四', '五', '六', '日'][index]}
                                                </span>
                                                <span className={`text-[9px] min-w-[16px] text-right truncate ${isHolidayType ? 'text-red-500 dark:text-red-400 font-medium' : isWorkday ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-transparent'}`}>
                                                    {isHolidayType ? (holiday.name && !['周六', '周日'].includes(holiday.name) ? holiday.name.substring(0, 2) : '休') : isWorkday ? '班' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Gantt Section for multi-day tasks */}
                            {multiDayTasks.length > 0 && (
                                <div className="relative border-b border-gray-200/60 dark:border-white/10 overflow-y-auto week-scrollbar" style={{ minHeight: Math.min(multiDayTasks.length * 20 + 8, 68), maxHeight: 68 }}>
                                    <div className="relative h-full" style={{ minHeight: multiDayTasks.length * 20 + 4 }}>
                                        {multiDayTasks.map((task, index) => {
                                            const { startCol, endCol } = getTaskVisibleRange(task)
                                            const leftPercent = (startCol / 7) * 100
                                            const widthPercent = ((endCol - startCol + 1) / 7) * 100
                                            const isCompleted = task.status === 'done'
                                            const durationDays = Math.ceil((new Date(task.due_date!).getTime() - new Date(task.start_date!).getTime()) / (1000 * 60 * 60 * 24)) + 1

                                            return (
                                                <div
                                                    key={task.id}
                                                    onClick={(e) => handleTaskClick(task, e)}
                                                    onContextMenu={(e) => handleContextMenu(e, task.due_date!, undefined, task)}
                                                    className={`absolute h-4 rounded pl-2.5 pr-1.5 flex items-center justify-between cursor-pointer hover:shadow-md transition-all shadow-sm bg-white/90 dark:bg-gray-700/90 border border-gray-200/50 dark:border-gray-600/30 text-[10px] overflow-hidden ${isCompleted ? 'opacity-50' : ''}`}
                                                    style={{
                                                        left: `${leftPercent}%`,
                                                        width: `calc(${widthPercent}% - 2px)`,
                                                        top: index * 20 + 2,
                                                    }}
                                                    title={`${task.title} (${task.start_date} ~ ${task.due_date})`}
                                                >
                                                    {/* Left priority color bar */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityColor(task.priority)}`} />
                                                    <span className={`text-gray-700 dark:text-gray-200 truncate flex-1 ${isCompleted ? 'line-through text-gray-400' : ''}`}>{task.title}</span>
                                                    <span className="text-gray-400 dark:text-gray-500 text-[8px] ml-1">{durationDays}天</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Day columns */}
                            <div className="flex-1 flex min-h-0">
                                {weekDays.map((date, index) => {
                                    const dateStr = format(date, 'yyyy-MM-dd')
                                    const dayData = weekTaskMap.get(dateStr) || { am: [], pm: [] }
                                    const isCurrentDay = isToday(date)

                                    return (
                                        <div key={dateStr} className={`flex-1 flex flex-col border-r border-gray-200/60 dark:border-white/10 last:border-r-0 min-w-0 ${isCurrentDay ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                            {/* AM Section */}
                                            <DroppableWeekCell
                                                date={dateStr}
                                                period="am"
                                                className={`flex-1 flex flex-col min-h-0 border-b border-gray-200/60 dark:border-white/10 overflow-hidden hover:bg-gray-100/40 dark:hover:bg-gray-800/40 transition-colors ${isCurrentDay ? 'bg-blue-50/40 dark:bg-blue-900/20' : ''}`}
                                                onContextMenu={(e) => handleContextMenu(e, dateStr, 'am', undefined, dayData.am)}
                                            >
                                                <div className="flex-1 overflow-y-auto px-1 py-1 space-y-1.5 week-scrollbar">
                                                    {dayData.am.map(task => (
                                                        <DraggableWeekTask
                                                            key={task.id}
                                                            task={task}
                                                            onClick={(e) => handleTaskClick(task, e)}
                                                            onContextMenu={(e) => handleContextMenu(e, dateStr, 'am', task)}
                                                        />
                                                    ))}
                                                </div>
                                            </DroppableWeekCell>

                                            {/* PM Section */}
                                            <DroppableWeekCell
                                                date={dateStr}
                                                period="pm"
                                                className={`flex-1 flex flex-col min-h-0 overflow-hidden hover:bg-gray-100/40 dark:hover:bg-gray-800/40 transition-colors ${isCurrentDay ? 'bg-blue-50/40 dark:bg-blue-900/20' : ''}`}
                                                onContextMenu={(e) => handleContextMenu(e, dateStr, 'pm', undefined, dayData.pm)}
                                            >
                                                <div className="flex-1 overflow-y-auto px-1 py-1 space-y-1.5 week-scrollbar">
                                                    {dayData.pm.map(task => (
                                                        <DraggableWeekTask
                                                            key={task.id}
                                                            task={task}
                                                            onClick={(e) => handleTaskClick(task, e)}
                                                            onContextMenu={(e) => handleContextMenu(e, dateStr, 'pm', task)}
                                                        />
                                                    ))}
                                                </div>
                                            </DroppableWeekCell>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Context Menu */}
                {contextMenu && (
                    <CalendarContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        date={contextMenu.date}
                        period={contextMenu.period}
                        task={contextMenu.task}
                        tasks={contextMenu.tasks}
                        onClose={closeContextMenu}
                        onCreateTask={handleCreateTask}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onToggleStatus={handleToggleStatus}
                        onCopyPeriodCompleted={() => handleCopyWeekCompleted()}
                        onOpenFormatSettings={() => setShowFormatSettings(true)}
                        viewPeriod="week"
                        completedCount={weekCompletedTasks.length}
                    />
                )}
            </GlassPanel>

            {/* Drag Overlay - Moved outside GlassPanel to fix offset caused by backdrop-blur */}
            <DragOverlay dropAnimation={null}>
                {activeTask && (
                    <div className="opacity-90 rotate-2 shadow-xl">
                        <div className="relative px-2 py-1 pl-3 rounded-lg border border-gray-100 text-xs bg-white shadow-lg">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getPriorityColor(activeTask.priority)}`} />
                            {activeTask.title}
                        </div>
                    </div>
                )}
            </DragOverlay>

            {/* Task Preview Card */}
            {previewTask && (
                <TaskPreviewCard
                    task={previewTask.task}
                    position={previewTask.position}
                    onClose={() => setPreviewTask(null)}
                    onEdit={() => {
                        setPreviewTask(null)
                        onTaskClick?.(previewTask.task)
                    }}
                    onToggleStatus={() => {
                        const task = previewTask.task
                        dispatch(updateTask({
                            ...task,
                            status: task.status === 'done' ? 'todo' : 'done',
                            completed_at: task.status === 'done' ? null : new Date().toISOString(),
                            is_pinned: false
                        }))
                        setPreviewTask(null)
                    }}
                />
            )}

            {/* Copy Format Settings Modal */}
            <CopyFormatSettingsModal
                isOpen={showFormatSettings}
                onClose={() => setShowFormatSettings(false)}
                onSave={(settings) => setCopyFormatSettings(settings)}
                initialSettings={copyFormatSettings}
                title="周视图 - 复制格式"
            />
        </DndContext>
    )
}
