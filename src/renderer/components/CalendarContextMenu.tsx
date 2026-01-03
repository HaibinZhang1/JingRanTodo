import React from 'react'
import ReactDOM from 'react-dom'
import { Plus, Edit3, Trash2, Check, X, Copy, Settings } from 'lucide-react'
import type { Task } from '../store/tasksSlice'

interface CalendarContextMenuProps {
    x: number
    y: number
    date: string  // YYYY-MM-DD
    period?: 'am' | 'pm'
    task?: Task | null  // 如果右键的是特定任务
    tasks?: Task[]  // 当前单元格的所有任务
    onClose: () => void
    onCreateTask: (date: string, period?: 'am' | 'pm') => void
    onEditTask?: (task: Task) => void
    onDeleteTask?: (taskId: string) => void
    onToggleStatus?: (taskId: string) => void
    // 新增：复制周/月已完成任务
    onCopyPeriodCompleted?: (period: 'week' | 'month') => void
    onOpenFormatSettings?: () => void
    viewPeriod?: 'week' | 'month'  // 当前视图类型
    completedCount?: number  // 已完成任务数量
}

/**
 * 日历右键菜单组件
 * 使用 Portal 渲染到 body，避免被父组件的 transform/overflow 影响
 */
export const CalendarContextMenu: React.FC<CalendarContextMenuProps> = ({
    x,
    y,
    date,
    period,
    task,
    tasks = [],
    onClose,
    onCreateTask,
    onEditTask,
    onDeleteTask,
    onToggleStatus,
    onCopyPeriodCompleted,
    onOpenFormatSettings,
    viewPeriod = 'week',
    completedCount = 0
}) => {
    // 点击外部关闭菜单
    React.useEffect(() => {
        const handleClickOutside = () => onClose()
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [onClose])

    // 阻止菜单本身的点击事件冒泡
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    // 简单视口边界检查
    const adjustedX = Math.min(x, window.innerWidth - 200)
    const adjustedY = Math.min(y, window.innerHeight - 300)

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9999 // 确保在最顶层
    }

    const periodLabel = viewPeriod === 'week' ? '本周' : '本月'

    const menuContent = (
        <div
            style={menuStyle}
            onClick={handleMenuClick}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px] animate-fade-in text-gray-700 dark:text-gray-200 select-none"
        >
            {task ? (
                <>
                    {/* 任务标题 */}
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="text-sm font-medium truncate max-w-[200px]">
                            {task.title}
                        </div>
                        {task.status === 'done' && (
                            <div className="text-xs text-gray-400 mt-0.5">
                                已完成
                            </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="py-1">
                        {onEditTask && (
                            <button
                                onClick={() => { onEditTask(task); onClose() }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                            >
                                <Edit3 size={16} className="text-gray-400" />
                                编辑
                            </button>
                        )}
                        {onToggleStatus && (
                            <button
                                onClick={() => { onToggleStatus(task.id); onClose() }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                            >
                                {task.status === 'done' ? (
                                    <>
                                        <X size={16} className="text-gray-400" />
                                        标记未完成
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} className="text-green-500" />
                                        标记完成
                                    </>
                                )}
                            </button>
                        )}
                        {onDeleteTask && (
                            <button
                                onClick={() => { onDeleteTask(task.id); onClose() }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                            >
                                <Trash2 size={16} />
                                删除
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* 日期标题 */}
                    <div className="px-4 py-1.5 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400">
                        {date} {period === 'am' ? '上午' : period === 'pm' ? '下午' : ''}
                    </div>

                    {/* 创建任务 */}
                    <button
                        onClick={() => { onCreateTask(date, period); onClose() }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 transition-colors"
                    >
                        <Plus size={16} className="text-blue-500" />
                        创建待办
                    </button>

                    {/* 如果有任务，显示批量操作 */}
                    {tasks.length > 0 && (
                        <>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                            <div className="px-4 py-1 text-xs text-gray-400">
                                {tasks.length} 个任务
                            </div>
                        </>
                    )}

                    {/* 复制周/月已完成任务 */}
                    {onCopyPeriodCompleted && completedCount > 0 && (
                        <>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                            <button
                                onClick={() => { onCopyPeriodCompleted(viewPeriod); onClose() }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-3 transition-colors"
                            >
                                <Copy size={16} className="text-green-500" />
                                复制{periodLabel}已完成 ({completedCount})
                            </button>
                        </>
                    )}

                    {/* 格式设置 */}
                    {onOpenFormatSettings && (
                        <button
                            onClick={() => { onOpenFormatSettings(); onClose() }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                        >
                            <Settings size={16} className="text-gray-400" />
                            复制格式设置
                        </button>
                    )}
                </>
            )}
        </div>
    )

    return ReactDOM.createPortal(menuContent, document.body)
}

export default CalendarContextMenu

