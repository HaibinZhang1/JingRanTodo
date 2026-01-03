import React, { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { X, Settings, GripHorizontal, Monitor, Square, Copy } from 'lucide-react'
import PanelInputBar from './PanelInputBar'

import GlassPanel from './GlassPanel'
import TaskCard from './TaskCard'
import { fetchTasks, updateTask as updateTaskAction, createSubtask, updateSubtask, createTask, deleteSubtask, deleteTask } from '../store/tasksSlice'
import TaskDetailModal from './TaskDetailModal'
import { formatLocalDate, getToday, getTomorrow, getSunday, getNextMonday } from '../utils/dateUtils'
import { toChineseNum } from '../utils/formatUtils'
import { generateTaskCopyText, TaskCopySettings } from '../utils/taskCopyUtils'
import { sortTasks } from '../utils/taskUtils'
import type { Task } from '../store/tasksSlice'

interface DesktopWidgetProps {
    cardId: string
    initialOpacity?: number
    title?: string
    onClose: () => void
}

/**
 * 桌面卡片挂件组件
 * 独立于主窗口，可以固定在桌面上
 */
export const DesktopWidget: React.FC<DesktopWidgetProps> = ({ cardId, initialOpacity = 80, title = "任务卡片", onClose }) => {
    const dispatch = useDispatch()
    const tasks = useSelector((state: any) => state.tasks?.items || [])
    const { copyFormat, copyTemplateTask, copyTemplateSubtask, themeConfig } = useSelector((state: any) => state.settings)

    // Dark mode detection based on settings
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        if (themeConfig?.mode === 'minimal' && themeConfig?.minimal?.variant === 'dark') {
            setIsDark(true)
        } else {
            setIsDark(false)
        }
    }, [themeConfig])

    const [opacity, setOpacity] = useState(initialOpacity)
    const [showSettings, setShowSettings] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [copyToast, setCopyToast] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'todo' | 'completed' | 'pinned'>('all')
    const [isDesktopMode, setIsDesktopMode] = useState(false) // 桌面模式状态
    const [isDesktopAvailable, setIsDesktopAvailable] = useState(false) // 桌面模式是否可用

    // Detail Modal State
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)

    // 加载任务数据
    useEffect(() => {
        dispatch(fetchTasks() as any)

        // 监听数据变化事件
        const unsubscribe = window.electronAPI?.onTaskDataChanged?.(() => {
            dispatch(fetchTasks() as any)
        })

        // 检查桌面模式是否可用
        window.electronAPI?.cardDesktopAvailable?.().then((available: boolean) => {
            setIsDesktopAvailable(available)
        })

        // 获取当前模式
        window.electronAPI?.cardGetMode?.(cardId).then((mode: string) => {
            setIsDesktopMode(mode === 'desktop')
        })

        return () => {
            unsubscribe?.()
        }
    }, [dispatch, cardId])

    // Ctrl + Mouse Wheel to adjust opacity
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -5 : 5
                const newOpacity = Math.max(30, Math.min(100, opacity + delta))
                handleOpacityChange(newOpacity)
            }
        }

        window.addEventListener('wheel', handleWheel, { passive: false })
        return () => window.removeEventListener('wheel', handleWheel)
    }, [opacity])

    // Show copy toast
    const showCopyToast = (message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setCopyToast(message)
        toastTimerRef.current = setTimeout(() => setCopyToast(null), 2000)
    }



    // 日期和任务工具函数已从 utils 模块导入

    // 过滤任务
    const allFilteredTasks = React.useMemo(() => tasks.filter((task: Task) => {
        // 1. Context Filter (Scope) - determining what tasks belong to this card
        let inScope = false
        const todayStr = getToday()

        if (cardId === 'card-today') {
            // 排除持续任务（持续任务会自动生成今日待办）
            if (task.auto_generate_daily) return false

            // Today Logic: No Panel + (Due <= Today OR (Done & Completed Today))
            // Matching TaskDashboard: panel_id === null
            const isNoPanel = !task.panel_id // null or undefined or empty
            if (isNoPanel) {
                // 未完成任务：截止日期 <= 今天（只比较日期部分）
                if (task.status !== 'done') {
                    if (task.due_date) {
                        const dueDateOnly = task.due_date.split('T')[0]
                        inScope = dueDateOnly <= todayStr
                    }
                } else {
                    // 已完成任务：使用本地日期比较，避免时区问题
                    if (task.completed_at) {
                        const completedDate = new Date(task.completed_at)
                        const completedLocalDate = formatLocalDate(completedDate)
                        inScope = completedLocalDate === todayStr
                    }
                }
            } else {
                // 自定义面板任务，开始日期是今天的也显示（只比较日期部分，不含时间）
                if (task.start_date) {
                    const todayNormalized = todayStr.replace(/-/g, '')
                    // 将存储的日期字符串（可能是 UTC ISO）转换为本地时间对象
                    let taskDate = new Date(task.start_date)
                    let startDateOnlyStr

                    if (isNaN(taskDate.getTime())) {
                        startDateOnlyStr = task.start_date.split(/[\sT]/)[0].replace(/[-/]/g, '')
                    } else {
                        const tYear = taskDate.getFullYear()
                        const tMonth = String(taskDate.getMonth() + 1).padStart(2, '0')
                        const tDay = String(taskDate.getDate()).padStart(2, '0')
                        startDateOnlyStr = `${tYear}${tMonth}${tDay}`
                    }

                    if (startDateOnlyStr === todayNormalized) {
                        inScope = true
                    }
                }
            }
        } else if (cardId === 'card-week') {
            // Week Logic: No Panel + Due > Today AND Due <= Sunday
            const sundayStr = getSunday()
            const isNoPanel = !task.panel_id
            if (isNoPanel && task.due_date) {
                const dueDateOnly = task.due_date.split('T')[0]
                inScope = dueDateOnly > todayStr && dueDateOnly <= sundayStr
            }
        } else if (cardId === 'card-nextWeek') {
            // Next Week: No Panel + Due >= Next Monday
            const nextMon = getNextMonday()
            const isNoPanel = !task.panel_id
            if (isNoPanel && task.due_date) {
                const dueDateOnly = task.due_date.split('T')[0]
                inScope = dueDateOnly >= nextMon
            }
        } else if (cardId.startsWith('card-panel-')) {
            // Legacy format: cardId = 'card-panel-XXX', task.panel_id = 'panel-XXX'
            const panelId = cardId.replace('card-', '')
            inScope = String(task.panel_id) === String(panelId)
        } else if (cardId.startsWith('card-') && !['card-today', 'card-week', 'card-nextWeek'].includes(cardId)) {
            // UUID format: cardId = 'card-UUID', task.panel_id could be 'UUID' or 'panel-UUID'
            const panelId = cardId.replace('card-', '')
            // Try both formats: direct match and with 'panel-' prefix
            inScope = String(task.panel_id) === String(panelId) ||
                String(task.panel_id) === `panel-${panelId}`
        } else {
            // Fallback for unknown formats
            // Only Float Window is created for Panels.
            inScope = true
        }

        if (!inScope) return false

        // 2. User Filter (UI) - filtering within the scope
        if (filter === 'all') return true  // 显示范围内的所有任务（包括已完成）
        if (filter === 'completed') return task.status === 'done'
        if (filter === 'pinned') return task.is_pinned

        // 'todo' filter (default logic for 'Today' UI button)
        // Show only incomplete tasks within the scope
        if (filter === 'todo') {
            return task.status !== 'done'
        }

        return true
    }), [tasks, filter, cardId])

    const sortedTasks = React.useMemo(() => sortTasks(allFilteredTasks), [allFilteredTasks])
    const displayTasks = sortedTasks.slice(0, 8)

    // 切换任务完成状态
    const handleToggleStatus = (taskId: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        if (task) {
            const isCompleting = task.status !== 'done'

            dispatch(updateTaskAction({
                ...task,
                status: isCompleting ? 'done' : 'todo',
                completed_at: isCompleting ? new Date().toISOString() : null,
                is_pinned: isCompleting ? false : task.is_pinned // 完成时自动取消置顶
            }) as any)
        }
    }

    // 切换置顶状态
    const handleTogglePin = (task: Task) => {
        const isPinning = !task.is_pinned
        const relevant = sortedTasks.filter(t => t.id !== task.id && t.status !== 'done')

        let newRank = task.rank
        const ts = Date.now().toString(36)

        if (isPinning) {
            const pinned = relevant.filter(t => t.is_pinned)
            if (pinned.length > 0) {
                const max = pinned.reduce((m, t) => t.rank > m ? t.rank : m, '')
                newRank = max + '~' + ts
            }
        } else {
            const normal = relevant.filter(t => !t.is_pinned)
            if (normal.length > 0) {
                const min = normal.reduce((m, t) => t.rank < m ? t.rank : m, '~~~~')
                newRank = min.slice(0, -1) + '!' + ts
            }
        }

        dispatch(updateTaskAction({ ...task, is_pinned: isPinning, rank: newRank }) as any)
    }

    // 子任务操作
    const handleAddSubtask = (taskId: string, title: string) => {
        dispatch(createSubtask({ taskId, title }) as any)
    }

    const handleToggleSubtask = (taskId: string, subtaskId: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        const subtask = task?.subtasks?.find((s: any) => s.id === subtaskId)
        if (subtask) {
            dispatch(updateSubtask({
                ...subtask,
                completed: !subtask.completed
            }) as any)
        }
    }

    // 设置透明度
    const handleOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity)
        window.electronAPI?.cardSetOpacity?.(cardId, newOpacity)
    }

    // getTomorrow 已从 utils/dateUtils 导入

    const handleAddTask = () => {
        if (!newTaskTitle.trim()) return

        let due_date: string | null = null
        let panel_id: string | null = null

        // Determine context based on cardId
        if (cardId === 'card-today') {
            due_date = getToday()
        } else if (cardId === 'card-week') {
            due_date = getTomorrow()
        } else if (cardId === 'card-nextWeek') {
            due_date = getNextMonday()
        } else if (cardId.startsWith('card-panel-')) {
            // Legacy format: cardId = 'card-panel-xxx', panel_id = 'panel-xxx'
            panel_id = cardId.replace('card-', '')
        } else if (cardId.startsWith('card-') && !['card-today', 'card-week', 'card-nextWeek'].includes(cardId)) {
            // UUID format: cardId = 'card-UUID', panel_id = 'UUID'
            panel_id = cardId.replace('card-', '')
        }

        dispatch(createTask({
            title: newTaskTitle.trim(),
            status: 'todo',
            priority: 'low',
            due_date,
            panel_id
        }) as any)

        setNewTaskTitle('')
    }

    const handleCopyCompletedTasks = () => {
        const completedTasks = allFilteredTasks.filter((t: Task) => t.status === 'done')
        if (completedTasks.length === 0) return

        const text = generateTaskCopyText(completedTasks, {
            copyFormat,
            copyTemplateTask,
            copyTemplateSubtask
        } as TaskCopySettings)

        navigator.clipboard.writeText(text).then(() => {
            showCopyToast(`已复制 ${completedTasks.length} 个已完成任务`)
        }).catch(err => {
            console.error('Failed to copy:', err)
        })
    }

    const handleEditTask = (task: Task) => {
        // 如果在桌面模式，临时切换到浮窗模式以允许输入
        if (isDesktopMode) {
            window.electronAPI?.cardToggleMode?.(cardId, 'floating')
        }
        setSelectedTask(task)
        setIsDetailOpen(true)
    }

    // 关闭编辑弹窗时恢复桌面模式
    const handleCloseDetail = () => {
        setIsDetailOpen(false)
        // 如果之前是桌面模式，恢复
        if (isDesktopMode) {
            setTimeout(() => {
                window.electronAPI?.cardToggleMode?.(cardId, 'desktop')
            }, 100)
        }
    }

    const handleUpdateTitle = (taskId: string, newTitle: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        if (task) {
            dispatch(updateTaskAction({ ...task, title: newTitle }) as any)
        }
    }

    const handleDeleteTask = (taskId: string) => {
        dispatch(deleteTask(taskId) as any)
    }

    const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, newTitle: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        const subtask = task?.subtasks?.find((s: any) => s.id === subtaskId)
        if (task && subtask) {
            dispatch(updateSubtask({ ...subtask, title: newTitle, taskId }) as any)
        }
    }

    const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
        dispatch(deleteSubtask({ taskId, subtaskId }) as any)
    }

    // 切换桌面模式 (防 Win+D 且覆盖图标)
    const handleToggleDesktopMode = () => {
        const newMode = isDesktopMode ? 'floating' : 'desktop'
        setIsDesktopMode(!isDesktopMode)
        window.electronAPI?.cardToggleMode?.(cardId, newMode)
    }

    // *** 贴边收起：状态 ***
    const [isDocked, setIsDocked] = useState(false)
    const [isExpanded, setIsExpanded] = useState(true)
    const isDraggingRef = useRef(false)
    const EDGE_THRESHOLD = 30

    // *** 贴边收起：边缘检测（支持多显示器）***
    const lastPositionRef = useRef({ x: window.screenX, y: window.screenY })
    const dragStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const initialCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const expandCooldownUntil = useRef<number>(0)
    const mouseInAreaRef = useRef<boolean>(false)

    const checkEdgeAndUpdate = (screenY: number, currentIsDocked: boolean) => {
        const displayTop = (window.screen as any).availTop || 0
        const distanceFromTop = screenY - displayTop
        if (distanceFromTop >= 0 && distanceFromTop <= EDGE_THRESHOLD) {
            if (!currentIsDocked) {
                setIsDocked(true)
                setIsExpanded(true)
            }
        } else {
            if (currentIsDocked) {
                setIsDocked(false)
                setIsExpanded(true)
            }
        }
    }

    useEffect(() => {
        // 初始检查：如果启动时就在边缘，直接收起，不要默认展开
        initialCheckTimerRef.current = setTimeout(() => {
            const displayTop = (window.screen as any).availTop || 0
            const distanceFromTop = window.screenY - displayTop

            if (distanceFromTop >= 0 && distanceFromTop <= EDGE_THRESHOLD) {
                setIsDocked(true)
                setIsExpanded(false)
            } else {
                checkEdgeAndUpdate(window.screenY, false)
            }
        }, 100)
        return () => {
            if (initialCheckTimerRef.current) clearTimeout(initialCheckTimerRef.current)
        }
    }, [])

    useEffect(() => {
        const checkInterval = setInterval(() => {
            const currentX = window.screenX
            const currentY = window.screenY
            const lastPos = lastPositionRef.current
            const positionChanged = currentX !== lastPos.x || currentY !== lastPos.y
            if (positionChanged) {
                if (!isDraggingRef.current) {
                    isDraggingRef.current = true
                    if (collapseTimerRef.current) {
                        clearTimeout(collapseTimerRef.current)
                        collapseTimerRef.current = null
                    }
                }
                lastPositionRef.current = { x: currentX, y: currentY }
                if (dragStopTimerRef.current) clearTimeout(dragStopTimerRef.current)
                dragStopTimerRef.current = setTimeout(() => {
                    isDraggingRef.current = false
                    checkEdgeAndUpdate(window.screenY, isDocked)
                }, 200)
            }
        }, 50)
        return () => {
            clearInterval(checkInterval)
            if (dragStopTimerRef.current) clearTimeout(dragStopTimerRef.current)
        }
    }, [isDocked])

    // 停靠且收起时禁用缩放边框（避免收起时显示缩放光标），其他情况（展开或未停靠）启用以便允许拖动
    useEffect(() => {
        const shouldBeResizable = !isDocked || isExpanded
        window.electronAPI?.cardSetResizable?.(cardId, shouldBeResizable)
    }, [isDocked, isExpanded, cardId])

    // 停靠且收起时缩小窗口高度到5px，展开时恢复（解决透明区域能响应鼠标的问题）
    const originalHeightRef = useRef(window.innerHeight || 400)
    useEffect(() => {
        if (isDocked) {
            if (!isExpanded) {
                // 收起：记录当前高度，然后缩小
                if (window.innerHeight > 10) {
                    originalHeightRef.current = window.innerHeight
                }
                ; (window.electronAPI as any)?.cardSetCollapsed?.(cardId, true, originalHeightRef.current)
            } else {
                // 展开：恢复原始高度
                ; (window.electronAPI as any)?.cardSetCollapsed?.(cardId, false, originalHeightRef.current)
            }
        }
    }, [isDocked, isExpanded, cardId])

    // 收起状态下，由于 setIgnoreMouseEvents(true)，正常的 onMouseEnter 不会触发
    // 使用轮询检测鼠标位置来触发展开
    useEffect(() => {
        if (!isDocked || isExpanded) return // 只在收起状态下轮询

        const pollInterval = setInterval(async () => {
            if ((window as any).electronAPI?.getMousePosition) {
                const pos = await (window as any).electronAPI.getMousePosition()
                const windowX = window.screenX
                const windowY = window.screenY
                const windowW = window.innerWidth
                const windowH = 5 // 收起后只有5px高度

                const isMouseOver = pos.x >= windowX && pos.x <= windowX + windowW &&
                    pos.y >= windowY && pos.y <= windowY + windowH

                if (isMouseOver && !isDraggingRef.current) {
                    expandCooldownUntil.current = Date.now() + 500
                    setIsExpanded(true)
                }
            }
        }, 100)

        return () => clearInterval(pollInterval)
    }, [isDocked, isExpanded])

    const handleEdgeMouseEnter = () => {
        mouseInAreaRef.current = true
        if (collapseTimerRef.current) {
            clearTimeout(collapseTimerRef.current)
            collapseTimerRef.current = null
        }
        if (isDocked && !isExpanded) {
            expandCooldownUntil.current = Date.now() + 500
            setIsExpanded(true)
        }
    }

    const handleEdgeMouseLeave = () => {
        mouseInAreaRef.current = false
        if (isDraggingRef.current) return

        if (isDocked) {
            const delay = Math.max(expandCooldownUntil.current - Date.now() + 100, 300)
            collapseTimerRef.current = setTimeout(() => {
                // 额外检查：确认鼠标确实在窗口外面
                // 这样即使 WebkitAppRegion: drag 区域触发了 mouseLeave，也不会错误收起
                const checkMousePosition = () => {
                    // 获取当前窗口在屏幕上的位置和大小
                    const windowX = window.screenX
                    const windowY = window.screenY
                    const windowW = window.innerWidth
                    const windowH = window.innerHeight

                    // 通过事件获取鼠标位置不可靠，使用 API
                    // 如果有 electronAPI 可以获取鼠标位置
                    if ((window as any).electronAPI?.getMousePosition) {
                        return (window as any).electronAPI.getMousePosition().then((pos: { x: number, y: number }) => {
                            const isInside = pos.x >= windowX && pos.x <= windowX + windowW &&
                                pos.y >= windowY && pos.y <= windowY + windowH
                            return !isInside
                        })
                    }
                    return Promise.resolve(true) // fallback: 假设真的离开了
                }

                checkMousePosition().then((shouldCollapse: boolean) => {
                    if (shouldCollapse && !mouseInAreaRef.current && !isDraggingRef.current && isDocked) {
                        setIsExpanded(false)
                    }
                })
            }, delay)
        }
    }

    useEffect(() => {
        return () => {
            if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        }
    }, [])

    const getEdgeTransform = () => {
        if (!isDocked || isExpanded) return 'none' // 使用 'none' 而不是 translateY(0) 以避免干扰拖动
        return 'translateY(calc(-100% + 5px))'
    }

    return (
        <div
            className={`h-screen w-screen bg-transparent overflow-hidden relative ${isDark ? 'dark' : ''}`}
        >

            <div
                className="h-full w-full transition-transform duration-300 ease-out"
                style={{
                    transform: getEdgeTransform(),
                    borderRadius: '12px', // Ensure consistent rounding
                    overflow: 'hidden'    // Clip inner content
                }}
                onMouseEnter={handleEdgeMouseEnter}
                onMouseLeave={handleEdgeMouseLeave}
            >
                <GlassPanel
                    isDark={isDark}
                    opacity={opacity}
                    className={`h-full w-full rounded-xl flex flex-col overflow-hidden border border-white/20 dark:border-gray-700/30 transition-shadow duration-300 ${isDocked && !isExpanded ? 'shadow-none' : 'shadow-xl'}`}
                    style={{
                        // 收起时手动指定较小的阴影 (约原来的1/4)，展开时使用类名定义的 shadow-xl
                        boxShadow: isDocked && !isExpanded ? '0 5px 12px -3px rgba(0, 0, 0, 0.15)' : undefined
                    }}
                >
                    {/* 紧凑标题栏 - 可拖拽 */}
                    <div
                        className="h-8 flex items-center justify-between px-2 shrink-0 cursor-move border-b border-gray-200/30 dark:border-white/10"
                        style={{ WebkitAppRegion: 'drag' } as any}
                    >
                        <div className="flex items-center gap-1.5">
                            <GripHorizontal size={12} className="text-gray-400" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{title}</span>
                            <span className="text-[10px] text-gray-400 ml-1">
                                {allFilteredTasks.filter((t: Task) => t.status !== 'done').length}/{allFilteredTasks.length}
                            </span>
                        </div>
                        <div
                            className="flex items-center"
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            {/* 过滤按钮组 - 内联在标题栏 */}
                            <div className="flex items-center mr-1">
                                {[
                                    { key: 'all', label: '全' },
                                    { key: 'todo', label: '待' },
                                    { key: 'pinned', label: '★' },
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key as any)}
                                        className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${filter === f.key
                                            ? 'bg-gray-500 text-white'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {isDesktopAvailable && (
                                <button
                                    onClick={handleToggleDesktopMode}
                                    className="p-1 rounded hover:bg-white/50 dark:hover:bg-white/10 text-gray-400"
                                    title={isDesktopMode ? "浮窗" : "桌面"}
                                >
                                    {isDesktopMode ? <Square size={12} /> : <Monitor size={12} />}
                                </button>
                            )}
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-1 rounded hover:bg-white/50 dark:hover:bg-white/10 text-gray-400"
                                title="设置"
                            >
                                <Settings size={12} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                                title="关闭"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    {/* 设置面板 - 折叠式 */}
                    {showSettings && (
                        <div className="px-2 py-1.5 border-b border-gray-200/30 dark:border-white/10 bg-white/20 dark:bg-black/20">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">透明度</span>
                                <input
                                    type="range"
                                    min="30"
                                    max="100"
                                    value={opacity}
                                    onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                                    className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded appearance-none cursor-pointer"
                                />
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 w-6">{opacity}%</span>
                            </div>
                        </div>
                    )}

                    {/* 任务列表 - 紧凑间距 */}
                    <div className="flex-1 overflow-y-auto px-1.5 py-1 scrollbar-hide">
                        {displayTasks.length > 0 ? (
                            displayTasks.map((task: Task) => (
                                <div key={task.id} className="mb-0.5">
                                    <TaskCard
                                        isDark={isDark}
                                        task={task}
                                        onToggleStatus={handleToggleStatus}
                                        onEdit={handleEditTask}
                                        onDelete={() => handleDeleteTask(task.id)}
                                        onTogglePin={handleTogglePin}
                                        onAddSubtask={handleAddSubtask}
                                        onToggleSubtask={handleToggleSubtask}
                                        onUpdateTitle={handleUpdateTitle}
                                        onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                                        onDeleteSubtask={handleDeleteSubtask}
                                        compact={true}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                                {filter === 'todo' ? '无待办 🎉' : '暂无任务'}
                            </div>
                        )}
                    </div>

                    {/* 底部输入栏 */}
                    <div className="shrink-0 px-1.5 pb-1">
                        <PanelInputBar
                            isDark={isDark}
                            placeholder="添加任务"
                            inputValue={newTaskTitle}
                            setInputValue={setNewTaskTitle}
                            onAdd={handleAddTask}
                            onDetailClick={(prefillTitle) => {
                                // 打开新建任务弹窗
                                setSelectedTask({
                                    title: prefillTitle || '',
                                    status: 'todo',
                                    priority: 'low',
                                    due_date: cardId === 'card-today' ? getToday() : cardId === 'card-week' ? getTomorrow() : cardId === 'card-nextWeek' ? getNextMonday() : null,
                                    panel_id: cardId.startsWith('card-panel-') ? cardId.replace('card-', '') : null
                                } as Task)
                                setIsDetailOpen(true)
                                setNewTaskTitle('') // 清空输入框
                            }}
                            compact={true}
                        />
                    </div>

                    {/* 底部状态栏 */}
                    <div className="h-5 flex items-center justify-between px-2 text-[10px] text-gray-400 border-t border-gray-200/30 dark:border-white/10 bg-white/5">
                        <span>{allFilteredTasks.filter((t: Task) => t.status === 'done').length} 已完成</span>

                        {allFilteredTasks.some((t: Task) => t.status === 'done') && (
                            <button
                                onClick={handleCopyCompletedTasks}
                                className="flex items-center gap-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                                title="复制已完成任务"
                            >
                                <Copy size={9} />
                                <span>复制</span>
                            </button>
                        )}
                    </div>
                </GlassPanel>

                {/* 复制成功提示 */}
                {copyToast && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                        <div className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg shadow-lg flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-medium">{copyToast}</span>
                        </div>
                    </div>
                )}
                {/* 任务详情弹窗 */}
                <div style={{ WebkitAppRegion: 'no-drag' } as any} className="select-text">
                    <TaskDetailModal
                        isDark={isDark}
                        isOpen={isDetailOpen}
                        onClose={handleCloseDetail}
                        task={selectedTask}
                    />
                </div>
            </div>
        </div >
    )
}

export default DesktopWidget
