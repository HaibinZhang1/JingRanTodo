import React, { useState, useEffect } from 'react'
import {
    format,
    addWeeks,
    subWeeks,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    eachMonthOfInterval,
    isToday,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    isSameMonth,
    addYears,
    subYears,
    startOfYear,
    endOfYear,
    isSameDay,
    getDay
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Copy, Filter } from 'lucide-react'
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useAppSelector, useAppDispatch } from '../hooks/useRedux'
import { updateTask, deleteTask as deleteTaskAction } from '../store/tasksSlice'
import { GlassPanel, CalendarContextMenu, CopyFormatSettingsModal, TaskPreviewCard } from '../components'
import { toChineseNum, getPriorityColor } from '../utils/formatUtils'
import { generateTaskCopyText, TaskCopySettings } from '../utils/taskCopyUtils'
import { parseIsoTime } from '../utils/dateUtils'
import type { Task } from '../store/tasksSlice'
import type { RootState } from '../store'
import { loadHolidayData, getHolidayInfo, preloadHolidayData } from '../services/holidayService'

interface CalendarViewProps {
    onOpenTaskDetail: (task: Task) => void
    isDark?: boolean
}

type ViewMode = 'week' | 'month' | 'year'

// getPriorityColor 已从 utils/formatUtils 导入

// Draggable Task Item
const DraggableTask: React.FC<{
    task: Task;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    variant?: 'am' | 'pm'
}> = ({ task, onClick, onContextMenu, variant = 'am' }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
        data: { task }
    })

    const isCompleted = task.status === 'done'
    const borderColor = variant === 'am' ? 'border-orange-100 dark:border-orange-900/30' : 'border-indigo-100 dark:border-indigo-900/30'
    const completedStyles = isCompleted ? 'line-through text-gray-400 dark:text-gray-500 bg-gray-50/80 dark:bg-gray-800/50' : 'bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200'
    const subtaskCount = task.subtasks?.length || 0
    const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => { e.stopPropagation(); onClick(e) }}
            onContextMenu={onContextMenu}
            className={`relative mb-1 px-2 py-1 pl-3 rounded-lg border ${borderColor} text-xs shadow-sm cursor-grab hover:scale-[1.02] transition-transform truncate ${completedStyles} ${isDragging ? 'opacity-50' : ''} overflow-hidden`}
        >
            {/* Left priority color bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityColor(task.priority)}`} />
            <div className="flex items-center justify-between gap-1">
                <span className="truncate">{task.title}</span>
                {subtaskCount > 0 && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-gray-100/80 text-gray-500">
                        {completedSubtasks}/{subtaskCount}
                    </span>
                )}
            </div>
        </div>
    )
}

// Droppable Day Cell (for month view)
const DroppableDay: React.FC<{
    date: Date;
    children: React.ReactNode;
    className?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ date, children, className, onContextMenu }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const { setNodeRef, isOver } = useDroppable({ id: `day-${dateStr}`, data: { date: dateStr, period: 'am' } })

    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`} onContextMenu={onContextMenu}>
            {children}
        </div>
    )
}

// Droppable AM/PM Container (for week view)
const DroppableAMPM: React.FC<{
    date: Date;
    period: 'am' | 'pm';
    children: React.ReactNode;
    className?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ date, period, children, className, onContextMenu }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const droppableId = `${period}-${dateStr}`
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { date: dateStr, period }
    })

    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`} onContextMenu={onContextMenu}>
            {children}
        </div>
    )
}

const CalendarView: React.FC<CalendarViewProps> = ({ onOpenTaskDetail, isDark = false }) => {
    const dispatch = useAppDispatch()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>('month')
    const [activeTask, setActiveTask] = useState<Task | null>(null)
    const tasks = useAppSelector((state: RootState) => state.tasks.items)

    // 配置 dnd-kit 传感器，添加距离限制以避免影响点击事件
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    )


    // 节假日加载状态
    const [holidayLoaded, setHolidayLoaded] = useState(false)

    // 加载节假日数据 - 组件挂载时立即加载
    useEffect(() => {
        const loadData = async () => {
            try {
                // 加载2025和2026年数据
                await preloadHolidayData([2025, 2026])
                setHolidayLoaded(true)
            } catch (error) {
                console.error('[CalendarView] Failed to load holiday data:', error)
            }
        }
        loadData()
    }, []) // 空依赖 - 只在组件挂载时执行一次

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        date: string
        period?: 'am' | 'pm'
        task?: Task | null
        tasks: Task[]
    } | null>(null)

    // 关闭右键菜单
    const closeContextMenu = () => setContextMenu(null)

    // 复制格式设置状态
    const [copyFormatSettings, setCopyFormatSettings] = React.useState<{
        copyFormat: 'text' | 'json' | 'markdown'
        copyTemplateTask: string
        copyTemplateSubtask: string
    }>({
        copyFormat: 'text',
        copyTemplateTask: '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
        copyTemplateSubtask: '    {{index}}.{{title}}\n        {{description}}'
    })
    const [showFormatSettings, setShowFormatSettings] = React.useState(false)
    const [previewTask, setPreviewTask] = useState<{ task: Task; position: { x: number; y: number } } | null>(null)

    const handleTaskClick = (task: Task, e: React.MouseEvent) => {
        e.stopPropagation()
        setPreviewTask({
            task,
            position: { x: e.clientX + 10, y: e.clientY + 10 }
        })
    }

    // 计算本月已完成任务
    const monthCompletedTasks = React.useMemo(() => {
        const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')
        return tasks.filter((t: Task) => {
            if (t.status !== 'done' || !t.due_date) return false
            // 提取日期部分进行比较
            const dueDateOnly = t.due_date.split('T')[0]
            return dueDateOnly >= monthStart && dueDateOnly <= monthEnd
        })
    }, [tasks, currentDate])

    // 右键任务
    const handleTaskContextMenu = (e: React.MouseEvent, task: Task, date: string, period?: 'am' | 'pm') => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            date,
            period,
            task,
            tasks: []
        })
    }

    // 右键单元格
    const handleCellContextMenu = (e: React.MouseEvent, date: string, period?: 'am' | 'pm', cellTasks?: Task[]) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            date,
            period,
            task: null,
            tasks: cellTasks || []
        })
    }

    // 创建任务
    const handleCreateTask = (date: string, period?: 'am' | 'pm') => {
        // 打开任务编辑弹窗，预填日期和时间
        // 根据上午/下午设置 created_at 时间
        const hour = period === 'pm' ? 14 : 8
        const created_at = `${date}T${String(hour).padStart(2, '0')}:00:00`
        onOpenTaskDetail({ due_date: date, created_at } as Task)
    }

    // 切换任务状态
    const handleToggleStatus = (taskId: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        if (task) {
            dispatch(updateTask({
                ...task,
                status: task.status === 'done' ? 'todo' : 'done',
                completed_at: task.status === 'done' ? null : new Date().toISOString(),
                is_pinned: task.status === 'done' ? task.is_pinned : false // If becoming done (current not done), unpin
            }))
        }
    }

    // 删除任务
    const handleDeleteTask = (taskId: string) => {
        dispatch(deleteTaskAction(taskId))
    }

    const handleCopyMonthCompleted = () => {
        if (monthCompletedTasks.length === 0) return

        // toChineseNum 已从 utils/formatUtils 导入

        const text = generateTaskCopyText(monthCompletedTasks, copyFormatSettings as TaskCopySettings)

        navigator.clipboard.writeText(text).then(() => {
            // Success - no action needed
        }).catch(err => {
            console.error('Failed to copy:', err)
        })
    }

    // Handle drag end - update task due_date and reminder_time based on AM/PM
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveTask(null)

        if (!over) return

        const taskId = active.id as string
        const newDate = over.data.current?.date as string
        const period = over.data.current?.period as 'am' | 'pm' | undefined

        if (!newDate) return

        const task = tasks.find((t: Task) => t.id === taskId)
        if (!task) return

        // 判断任务原来的时间段（优先使用 reminder_time，其次使用 created_at）
        let taskTimeSource = task.reminder_time || task.created_at
        let originalIsAM = true // 默认为上午
        if (taskTimeSource) {
            const taskDate = new Date(taskTimeSource)
            originalIsAM = taskDate.getHours() < 12
        }

        // 计算新的提醒时间
        let newReminderTime: string | undefined = task.reminder_time

        if (period) {
            const targetIsAM = period === 'am'

            // 如果时间段改变，则更新提醒时间
            if (originalIsAM !== targetIsAM) {
                if (targetIsAM) {
                    // 从下午拖到上午，设置为 8:00
                    newReminderTime = `${newDate}T08:00:00`
                } else {
                    // 从上午拖到下午，设置为 14:00
                    newReminderTime = `${newDate}T14:00:00`
                }
            } else if (task.due_date !== newDate && task.reminder_time) {
                // 同一时间段但日期变了，只更新日期部分，保持时间不变
                const timePart = task.reminder_time.split('T')[1] || (originalIsAM ? '08:00:00' : '14:00:00')
                newReminderTime = `${newDate}T${timePart}`
            } else if (task.due_date !== newDate && !task.reminder_time) {
                // 没有 reminder_time，根据 created_at 的时间设置新的 reminder_time
                if (task.created_at) {
                    const createdDate = new Date(task.created_at)
                    const hours = String(createdDate.getHours()).padStart(2, '0')
                    const minutes = String(createdDate.getMinutes()).padStart(2, '0')
                    newReminderTime = `${newDate}T${hours}:${minutes}:00`
                } else {
                    newReminderTime = `${newDate}T${originalIsAM ? '08:00:00' : '14:00:00'}`
                }
            }
        }

        // 更新任务
        // 【重要】在日历中拖拽任务时，清除 panel_id，防止任务同时出现在时间面板和自定义面板
        if (task.due_date !== newDate || task.reminder_time !== newReminderTime) {
            // 对于普通单日任务（start_date === due_date），同步更新 start_date
            // 避免任务被错误识别为跨天任务 - 只比较日期部分
            const taskStartDateOnly = task.start_date?.split('T')[0]
            const taskDueDateOnly = task.due_date?.split('T')[0]
            const isOriginalSingleDayTask = !task.start_date || taskStartDateOnly === taskDueDateOnly
            const newStartDate = isOriginalSingleDayTask ? newDate : task.start_date

            dispatch(updateTask({
                ...task,
                start_date: newStartDate,
                due_date: newDate,
                reminder_time: newReminderTime,
                panel_id: null  // 清除自定义面板归属，让任务回到时间维度面板
            }))
        }
    }

    const handleDragStart = (event: any) => {
        const task = event.active.data.current?.task
        if (task) setActiveTask(task)
    }

    const navigate = (direction: 'prev' | 'next') => {
        if (viewMode === 'week') {
            setCurrentDate(d => direction === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1))
        } else if (viewMode === 'month') {
            setCurrentDate(d => direction === 'prev' ? subMonths(d, 1) : addMonths(d, 1))
        } else {
            setCurrentDate(d => direction === 'prev' ? subYears(d, 1) : addYears(d, 1))
        }
    }

    const resetToday = () => setCurrentDate(new Date())

    const getHeaderTitle = () => {
        if (viewMode === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 })
            const end = endOfWeek(currentDate, { weekStartsOn: 1 })
            if (isSameMonth(start, end)) {
                return format(start, 'yyyy年 M月', { locale: zhCN })
            }
            return `${format(start, 'yyyy年 M月', { locale: zhCN })} - ${format(end, 'M月', { locale: zhCN })}`
        }
        if (viewMode === 'month') {
            return format(currentDate, 'yyyy年 M月', { locale: zhCN })
        }
        return format(currentDate, 'yyyy年', { locale: zhCN })
    }

    // 获取某天的任务（包括已完成的）- 排除跨天任务
    const getTasksForDay = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return tasks.filter((task: Task) => {
            // 跨天任务不在普通单元格显示
            if (isMultiDayTask(task)) return false
            // 提取日期部分进行比较
            const dueDateOnly = task.due_date?.split('T')[0]
            return dueDateOnly === dateStr
        })
    }

    // 判断是否为多日任务（开始日期 != 截止日期）- 只比较日期部分
    const isMultiDayTask = (task: Task): boolean => {
        if (!task.start_date || !task.due_date) return false
        const startDateOnly = task.start_date.split('T')[0]
        const dueDateOnly = task.due_date.split('T')[0]
        return startDateOnly !== dueDateOnly
    }

    // 计算任务跨越的天数
    const getTaskDurationDays = (task: Task): number => {
        if (!task.start_date || !task.due_date) return 1
        const start = new Date(task.start_date)
        const end = new Date(task.due_date)
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }

    // 获取当前周内的跨天任务
    const getMultiDayTasksForWeek = (weekStart: Date, weekEnd: Date): Task[] => {
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
        return tasks.filter((task: Task) => {
            if (!isMultiDayTask(task)) return false
            // 提取日期部分进行比较
            const taskStart = task.start_date!.split('T')[0]
            const taskEnd = task.due_date!.split('T')[0]
            // 任务与当前周有交集
            return taskStart <= weekEndStr && taskEnd >= weekStartStr
        })
    }

    // 获取任务在当前周的可见范围（列索引 0-6）
    const getTaskVisibleRange = (task: Task, weekStart: Date, weekEnd: Date): { startCol: number, endCol: number } => {
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
        // 提取日期部分，避免时间影响计算
        const taskStartStr = task.start_date!.split('T')[0]
        const taskEndStr = task.due_date!.split('T')[0]

        // 计算可见起始列
        let startCol = 0
        if (taskStartStr > weekStartStr) {
            const taskStartDate = new Date(taskStartStr + 'T00:00:00')
            const weekStartDate = new Date(weekStartStr + 'T00:00:00')
            const diffDays = Math.round((taskStartDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
            startCol = Math.max(0, diffDays)
        }

        // 计算可见结束列
        let endCol = 6
        if (taskEndStr < weekEndStr) {
            const taskEndDate = new Date(taskEndStr + 'T00:00:00')
            const weekStartDate = new Date(weekStartStr + 'T00:00:00')
            const diffDays = Math.round((taskEndDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
            endCol = Math.min(6, diffDays)
        }

        return { startCol, endCol }
    }

    // Gantt bar 使用白色背景 + 左侧优先级颜色条
    const getGanttColorClass = (priority: string): string => {
        return getPriorityColor(priority)
    }

    // 判断任务是上午还是下午（基于 reminder_time 或 created_at，与 12:00 比较）
    // 判断任务是上午还是下午（基于 reminder_time 或 created_at，与 12:00 比较）
    const isTaskAM = (task: Task): boolean => {
        // 优先使用 reminder_time
        if (task.reminder_time) {
            return parseIsoTime(task.reminder_time).hour < 12
        }
        // 其次使用 created_at
        if (task.created_at) {
            return parseIsoTime(task.created_at).hour < 12
        }
        // 默认上午
        return true
    }

    const renderWeekView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
        const end = endOfWeek(currentDate, { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start, end })
        const weekDays = ['一', '二', '三', '四', '五', '六', '日']

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header Row */}
                <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 pb-2 mb-2">
                    <div className="w-16 shrink-0" /> {/* Time axis spacer */}
                    {days.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const holiday = getHolidayInfo(dateStr)
                        const isHolidayType = holiday.type === 2
                        const isWorkday = holiday.type === 3
                        const isWeekendType = holiday.type === 1
                        const isTodayDate = isToday(day)

                        // 更明显的样式
                        let headerBg = ''
                        let headerTextColor = 'text-gray-500'
                        let dateTextColor = 'text-gray-700'
                        let holidayLabel = ''

                        // 今日优先级最高
                        if (isTodayDate) {
                            headerBg = 'bg-blue-100/80 dark:bg-blue-900/50'
                            headerTextColor = 'text-blue-600 dark:text-blue-400'
                            dateTextColor = 'text-blue-600 dark:text-blue-400'
                        } else if (isHolidayType) {
                            headerBg = 'bg-red-100 dark:bg-red-900/50'
                            headerTextColor = 'text-red-500'
                            dateTextColor = 'text-red-600 dark:text-red-400'
                            holidayLabel = holiday.name || '假'
                        } else if (isWorkday) {
                            headerBg = 'bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600'
                            headerTextColor = 'text-yellow-600 dark:text-yellow-400'
                            dateTextColor = 'text-yellow-700 dark:text-yellow-300'
                            holidayLabel = '班'
                        } else if (isWeekendType) {
                            headerBg = 'bg-gray-100 dark:bg-gray-700/50'
                            headerTextColor = 'text-gray-400'
                            dateTextColor = 'text-gray-500 dark:text-gray-400'
                        }

                        return (
                            <div
                                key={day.toString()}
                                className={`flex-1 text-center rounded-lg py-1 mx-0.5 ${headerBg}`}
                            >
                                <div className={`text-xs mb-1 ${headerTextColor}`}>
                                    周{weekDays[idx]}
                                </div>
                                <div className={`text-sm font-bold ${dateTextColor}`}>
                                    {format(day, 'd')}
                                </div>
                                {/* 节假日/补班标签 */}
                                {holiday.type !== null && holiday.name && !['周六', '周日'].includes(holiday.name) && !isTodayDate && (
                                    <div className={`text-[10px] mt-0.5 truncate px-1 ${isHolidayType ? 'text-red-500' :
                                        isWorkday ? 'text-yellow-600' :
                                            'text-gray-400'
                                        }`}>
                                        {isWorkday ? '补班' : holiday.name}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Content Grid with optional Gantt section */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* 甲特图区域 - 跨天任务 */}
                    {(() => {
                        const multiDayTasks = getMultiDayTasksForWeek(start, end)
                        if (multiDayTasks.length === 0) return null

                        return (
                            <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 shrink-0" style={{ minHeight: Math.min(multiDayTasks.length * 28 + 8, 100) }}>
                                {/* Left axis label */}
                                <div className="w-16 shrink-0 flex items-center justify-center border-r border-gray-200/30 dark:border-gray-700/30 text-xs text-gray-400 font-medium bg-purple-50/50 dark:bg-purple-900/20">
                                    <span>持续</span>
                                </div>
                                {/* Gantt bars area */}
                                <div className="flex-1 relative overflow-y-auto week-scrollbar">
                                    <div className="relative" style={{ minHeight: multiDayTasks.length * 28 + 4 }}>
                                        {multiDayTasks.map((task, index) => {
                                            const { startCol, endCol } = getTaskVisibleRange(task, start, end)
                                            const leftPercent = (startCol / 7) * 100
                                            const widthPercent = ((endCol - startCol + 1) / 7) * 100
                                            const durationDays = getTaskDurationDays(task)
                                            const isCompleted = task.status === 'done'

                                            return (
                                                <div
                                                    key={task.id}
                                                    onClick={(e) => handleTaskClick(task, e)}
                                                    onContextMenu={(e) => handleTaskContextMenu(e, task, task.due_date!)}
                                                    className={`absolute h-6 rounded-md pl-3 pr-2 flex items-center justify-between cursor-pointer hover:shadow-md transition-all shadow-sm bg-white/90 dark:bg-gray-700/90 border border-gray-200/50 dark:border-gray-600/50 overflow-hidden ${isCompleted ? 'opacity-50' : ''}`}
                                                    style={{
                                                        left: `${leftPercent}%`,
                                                        width: `calc(${widthPercent}% - 4px)`,
                                                        top: index * 28 + 2,
                                                    }}
                                                    title={`${task.title} (${task.start_date} ~ ${task.due_date})`}
                                                >
                                                    {/* Left priority color bar */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getGanttColorClass(task.priority)}`} />
                                                    <span className={`text-gray-700 dark:text-gray-200 text-xs truncate flex-1 ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                                                        {task.title}
                                                    </span>
                                                    <span className="text-gray-400 text-[10px] ml-2 shrink-0">
                                                        {durationDays}天
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* AM/PM Content Grid */}
                    <div className="flex-1 flex overflow-y-auto min-h-0">
                        {/* Time Axis */}
                        <div className="w-16 shrink-0 flex flex-col border-r border-gray-200/30 dark:border-gray-700/30 text-xs text-gray-400 font-medium">
                            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-orange-50/50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/20 border-b border-gray-100/50 dark:border-gray-700/30">
                                <span>上午</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-indigo-50/50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/20">
                                <span>下午</span>
                            </div>
                        </div>

                        {/* Days Columns */}
                        <div className="flex-1 grid grid-cols-7">
                            {days.map((day) => {
                                const dayTasks = getTasksForDay(day)
                                // 分离未完成和已完成任务
                                const pendingTasks = dayTasks.filter((task: Task) => task.status !== 'done')
                                const completedTasks = dayTasks.filter((task: Task) => task.status === 'done')

                                // 根据时间分类上午/下午（未完成任务在前，已完成在后）
                                const am = [
                                    ...pendingTasks.filter((task: Task) => isTaskAM(task)),
                                    ...completedTasks.filter((task: Task) => isTaskAM(task))
                                ]
                                const pm = [
                                    ...pendingTasks.filter((task: Task) => !isTaskAM(task)),
                                    ...completedTasks.filter((task: Task) => !isTaskAM(task))
                                ]

                                return (
                                    <div key={day.toString()} className={`flex flex-col border-r border-gray-100/30 dark:border-gray-700/30 last:border-0 ${isToday(day) ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}>
                                        {/* AM Container */}
                                        <DroppableAMPM
                                            date={day}
                                            period="am"
                                            className={`flex-1 p-1 hover:bg-orange-50/30 dark:hover:bg-orange-900/30 transition-colors border-b border-gray-100/50 dark:border-gray-700/30 overflow-y-auto week-scrollbar min-h-[100px] ${isToday(day) ? 'bg-blue-50/40 dark:bg-blue-900/30' : 'bg-orange-50/10 dark:bg-orange-900/10'}`}
                                            onContextMenu={(e) => handleCellContextMenu(e, format(day, 'yyyy-MM-dd'), 'am', am)}
                                        >
                                            {am.map((task: Task) => (
                                                <DraggableTask
                                                    key={task.id}
                                                    task={task}
                                                    onClick={(e) => handleTaskClick(task, e)}
                                                    onContextMenu={(e) => handleTaskContextMenu(e, task, format(day, 'yyyy-MM-dd'), 'am')}
                                                    variant="am"
                                                />
                                            ))}
                                        </DroppableAMPM>
                                        {/* PM Container */}
                                        <DroppableAMPM
                                            date={day}
                                            period="pm"
                                            className={`flex-1 p-1 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/30 transition-colors overflow-y-auto week-scrollbar min-h-[100px] ${isToday(day) ? 'bg-blue-50/40 dark:bg-blue-900/30' : 'bg-indigo-50/10 dark:bg-indigo-900/10'}`}
                                            onContextMenu={(e) => handleCellContextMenu(e, format(day, 'yyyy-MM-dd'), 'pm', pm)}
                                        >
                                            {pm.map((task: Task) => (
                                                <DraggableTask
                                                    key={task.id}
                                                    task={task}
                                                    onClick={(e) => handleTaskClick(task, e)}
                                                    onContextMenu={(e) => handleTaskContextMenu(e, task, format(day, 'yyyy-MM-dd'), 'pm')}
                                                    variant="pm"
                                                />
                                            ))}
                                        </DroppableAMPM>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start: startDate, end: endDate })
        const weekDays = ['一', '二', '三', '四', '五', '六', '日']

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-7 mb-2 border-b border-gray-200/50 pb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-1">
                            周{day}
                        </div>
                    ))}
                </div>

                {/* 月视图甘特图区域 - 跨天任务 */}
                {(() => {
                    const monthMultiDayTasks = tasks.filter((task: Task) => {
                        if (!isMultiDayTask(task)) return false
                        // 提取日期部分进行比较
                        const taskStart = task.start_date!.split('T')[0]
                        const taskEnd = task.due_date!.split('T')[0]
                        const monthStartStr = format(startDate, 'yyyy-MM-dd')
                        const monthEndStr = format(endDate, 'yyyy-MM-dd')
                        // 任务与当前月视图有交集
                        return taskStart <= monthEndStr && taskEnd >= monthStartStr
                    })

                    if (monthMultiDayTasks.length === 0) return null

                    return (
                        <div className="border-b border-gray-200/50 mb-2">
                            <div className="relative overflow-y-auto max-h-20 week-scrollbar">
                                <div className="relative" style={{ minHeight: monthMultiDayTasks.length * 24 + 4 }}>
                                    {monthMultiDayTasks.map((task, index) => {
                                        // 计算在月视图网格中的位置 - 使用日期部分避免时间影响
                                        const taskStartStr = task.start_date!.split('T')[0]
                                        const taskEndStr = task.due_date!.split('T')[0]
                                        const taskStartDate = new Date(taskStartStr + 'T00:00:00')
                                        const taskEndDate = new Date(taskEndStr + 'T00:00:00')
                                        const gridStartDate = startDate
                                        const gridStartStr = format(gridStartDate, 'yyyy-MM-dd')
                                        const gridStartNormalized = new Date(gridStartStr + 'T00:00:00')

                                        // 计算起始和结束列（在月视图网格中的位置）
                                        const startDiff = Math.max(0, Math.round((taskStartDate.getTime() - gridStartNormalized.getTime()) / (1000 * 60 * 60 * 24)))
                                        const endDiff = Math.min(days.length - 1, Math.round((taskEndDate.getTime() - gridStartNormalized.getTime()) / (1000 * 60 * 60 * 24)))

                                        const startCol = startDiff % 7
                                        const startRow = Math.floor(startDiff / 7)
                                        const endCol = endDiff % 7
                                        const endRow = Math.floor(endDiff / 7)

                                        // 简化：只显示单行（如果跨多周则截断到第一周）
                                        // 更复杂的跨周显示需要更多逻辑
                                        const displayEndCol = startRow === endRow ? endCol : 6
                                        const leftPercent = (startCol / 7) * 100
                                        const widthPercent = ((displayEndCol - startCol + 1) / 7) * 100
                                        const durationDays = getTaskDurationDays(task)
                                        const isCompleted = task.status === 'done'

                                        return (
                                            <div
                                                key={task.id}
                                                onClick={(e) => handleTaskClick(task, e)}
                                                onContextMenu={(e) => handleTaskContextMenu(e, task, task.due_date!)}
                                                className={`absolute h-5 rounded-md pl-3 pr-2 flex items-center justify-between cursor-pointer hover:shadow-md transition-all shadow-sm bg-white/90 dark:bg-gray-700/90 border border-gray-200/50 dark:border-gray-600/50 overflow-hidden ${isCompleted ? 'opacity-50' : ''}`}
                                                style={{
                                                    left: `${leftPercent}%`,
                                                    width: `calc(${widthPercent}% - 4px)`,
                                                    top: index * 24 + 2,
                                                }}
                                                title={`${task.title} (${task.start_date} ~ ${task.due_date})`}
                                            >
                                                {/* Left priority color bar */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getGanttColorClass(task.priority)}`} />
                                                <span className={`text-gray-700 text-xs truncate flex-1 ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                                    {task.title}
                                                </span>
                                                <span className="text-gray-400 text-[10px] ml-2 shrink-0">
                                                    {durationDays}天
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })()}
                <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-2 min-h-0">
                    {days.map((day) => {
                        const dayTasks = getTasksForDay(day)
                        // 排序：未完成任务在前，已完成任务在后
                        const sortedTasks = [
                            ...dayTasks.filter((t: Task) => t.status !== 'done'),
                            ...dayTasks.filter((t: Task) => t.status === 'done')
                        ]
                        const isCurrentMonth = isSameMonth(day, monthStart)
                        const isDayToday = isToday(day)

                        // 节假日信息
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const holiday = getHolidayInfo(dateStr)
                        const isHolidayType = holiday.type === 2
                        const isWorkday = holiday.type === 3
                        const isWeekendType = holiday.type === 1

                        // 节假日背景样式
                        const holidayBg = isHolidayType ? 'bg-red-50/60 dark:bg-red-900/30' :
                            isWorkday ? 'border-yellow-400 dark:border-yellow-600' :
                                isWeekendType ? 'bg-gray-50/40 dark:bg-gray-800/40' : ''

                        return (
                            <DroppableDay
                                key={day.toString()}
                                date={day}
                                className={`
                                    relative flex flex-col p-1 rounded-xl transition-colors border
                                    ${isCurrentMonth ? `bg-white/40 dark:bg-gray-700/40 border-white/40 dark:border-white/10 ${holidayBg}` : 'bg-gray-50/30 dark:bg-gray-800/30 border-transparent text-gray-400 dark:text-gray-500'}
                                    ${isDayToday ? 'bg-blue-100/60 dark:bg-blue-900/40 ring-2 ring-blue-400 z-10' : ''}
                                    ${isWorkday && isCurrentMonth ? 'border-yellow-400 dark:border-yellow-600' : ''}
                                    hover:bg-white/60 dark:hover:bg-gray-700/60
                                `}
                                onContextMenu={(e) => handleCellContextMenu(e, format(day, 'yyyy-MM-dd'), undefined, sortedTasks)}
                            >
                                <div className="flex items-center justify-between px-2 py-0.5">
                                    {/* 节假日标签 */}
                                    {holiday.type !== null && holiday.name && !['周六', '周日'].includes(holiday.name) && isCurrentMonth && (
                                        <span className={`text-[9px] truncate ${isHolidayType ? 'text-red-500' :
                                            isWorkday ? 'text-yellow-600' :
                                                'text-gray-400'
                                            }`}>
                                            {isWorkday ? '班' : holiday.name.substring(0, 2)}
                                        </span>
                                    )}
                                    {(!holiday.type || ['周六', '周日'].includes(holiday.name || '')) && <span />}

                                    {/* 日期数字 */}
                                    <span className={`text-sm font-medium ${isDayToday ? 'text-blue-600' :
                                        isHolidayType && isCurrentMonth ? 'text-red-600' :
                                            isWorkday && isCurrentMonth ? 'text-yellow-700' :
                                                ''
                                        }`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto week-scrollbar px-1 space-y-1">
                                    {sortedTasks.map((task: Task) => (
                                        <DraggableTask
                                            key={task.id}
                                            task={task}
                                            onClick={(e) => handleTaskClick(task, e)}
                                            onContextMenu={(e) => handleTaskContextMenu(e, task, format(day, 'yyyy-MM-dd'))}
                                        />
                                    ))}
                                </div>
                            </DroppableDay>
                        )
                    })}
                </div>
            </div>
        )
    }

    // Heatmap Year View
    const renderYearView = () => {
        const start = startOfYear(currentDate)
        const end = endOfYear(currentDate)
        const months = eachMonthOfInterval({ start, end })

        const getTaskCount = (date: Date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            // 提取日期部分进行比较
            return tasks.filter((t: Task) => {
                if (!t.due_date) return false
                const dueDateOnly = t.due_date.split('T')[0]
                return dueDateOnly === dateStr
            }).length
        }

        const getIntensityClass = (count: number) => {
            if (count === 0) return 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            if (count <= 2) return 'bg-green-200 dark:bg-green-900/60 hover:bg-green-300 dark:hover:bg-green-800/60'
            if (count <= 4) return 'bg-green-300 dark:bg-green-800/60 hover:bg-green-400 dark:hover:bg-green-700/60'
            if (count <= 6) return 'bg-green-400 dark:bg-green-700/60 hover:bg-green-500 dark:hover:bg-green-600/60'
            return 'bg-green-500 dark:bg-green-600/60 hover:bg-green-600 dark:hover:bg-green-500/60'
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4 overflow-y-auto h-full pb-20 week-scrollbar">
                {months.map(month => (
                    <div key={month.toISOString()} className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 pl-1">{format(month, 'M月', { locale: zhCN })}</h3>
                        <div className="grid grid-cols-7 gap-1">
                            {/* Day headers */}
                            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                                <div key={d} className="text-[10px] text-gray-300 text-center scale-90">{d}</div>
                            ))}

                            {/* Padding */}
                            {Array.from({ length: getDay(startOfMonth(month)) }).map((_, i) => (
                                <div key={`pad-${i}`} />
                            ))}

                            {/* Days */}
                            {eachDayOfInterval({
                                start: startOfMonth(month),
                                end: endOfMonth(month)
                            }).map(day => {
                                const count = getTaskCount(day)
                                const isDayToday = isSameDay(day, new Date())
                                return (
                                    <div
                                        key={day.toISOString()}
                                        onClick={() => {
                                            setCurrentDate(day)
                                            setViewMode('week')
                                        }}
                                        title={`${format(day, 'yyyy-MM-dd')}: ${count} 个任务`}
                                        className={`
                                            aspect-square rounded-[3px] cursor-pointer transition-colors relative
                                            flex items-center justify-center
                                            ${isDayToday ? 'bg-blue-400 hover:bg-blue-500 text-white font-bold' : getIntensityClass(count)}
                                            ${isDayToday ? '' : 'ring-0'}
                                        `}
                                    >
                                        <span className={`text-[8px] ${isDayToday ? 'text-white' : 'text-gray-600'}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="flex-1 h-full p-4 flex flex-col overflow-hidden">
            {/* Navigation Header */}
            <div className="flex items-center mb-4 px-2">
                {/* Left: Date Title */}
                <div className="flex items-center gap-2">
                    <CalendarIcon className="text-blue-500 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 min-w-[180px]">
                        {getHeaderTitle()}
                    </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Right: Navigation Controls + View Switcher */}
                <div className="flex items-center gap-3">
                    {/* Navigation Controls - styled like View Switcher */}
                    <div className="flex items-center bg-gray-100/50 dark:bg-gray-700/30 p-1 rounded-xl h-10">
                        <button
                            onClick={() => navigate('prev')}
                            className="h-full px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors flex items-center justify-center"
                            title={viewMode === 'week' ? '上周' : viewMode === 'month' ? '上月' : '上一年'}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={resetToday}
                            className="h-full px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors flex items-center justify-center"
                            title={viewMode === 'week' ? '回到本周' : viewMode === 'month' ? '回到本月' : '回到今年'}
                        >
                            <RotateCcw size={16} />
                        </button>
                        <button
                            onClick={() => navigate('next')}
                            className="h-full px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors flex items-center justify-center"
                            title={viewMode === 'week' ? '下周' : viewMode === 'month' ? '下月' : '下一年'}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center bg-gray-100/50 dark:bg-gray-700/30 p-1 rounded-xl h-10">
                        {(['week', 'month', 'year'] as ViewMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`
                                    h-full px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center
                                    ${viewMode === mode ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                                `}
                            >
                                {mode === 'week' ? '周' : mode === 'month' ? '月' : '年'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Calendar Content */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart} autoScroll={false}>
                <GlassPanel isDark={isDark} variant="panel" className="flex-1 flex flex-col overflow-hidden rounded-2xl p-4">
                    {viewMode === 'week' && renderWeekView()}
                    {viewMode === 'month' && renderMonthView()}
                    {viewMode === 'year' && renderYearView()}
                </GlassPanel>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeTask ? (
                        <div className="px-3 py-2 rounded-lg bg-blue-100 border border-blue-300 text-sm text-blue-800 shadow-lg">
                            {activeTask.title}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

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
                    onEditTask={onOpenTaskDetail}
                    onDeleteTask={handleDeleteTask}
                    onToggleStatus={handleToggleStatus}
                    onCopyPeriodCompleted={() => handleCopyMonthCompleted()}
                    onOpenFormatSettings={() => setShowFormatSettings(true)}
                    viewPeriod="month"
                    completedCount={monthCompletedTasks.length}
                />
            )}

            {/* Copy Format Settings Modal */}
            <CopyFormatSettingsModal
                isOpen={showFormatSettings}
                onClose={() => setShowFormatSettings(false)}
                onSave={(settings) => setCopyFormatSettings(settings)}
                initialSettings={copyFormatSettings}
                title="日历视图 - 复制格式"
            />

            {previewTask && (
                <TaskPreviewCard
                    task={previewTask.task}
                    position={previewTask.position}
                    onClose={() => setPreviewTask(null)}
                    onEdit={() => {
                        setPreviewTask(null)
                        onOpenTaskDetail(previewTask.task)
                    }}
                    onToggleStatus={() => {
                        handleToggleStatus(previewTask.task.id)
                        setPreviewTask(null)
                    }}
                />
            )}
        </div>
    )
}

export default CalendarView
