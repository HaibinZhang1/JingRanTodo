import React, { useState } from 'react'
import {
    CheckCircle, Circle, Pin, Edit3, Trash2,
    ChevronDown, ChevronUp, Plus, Check, Copy, AlertTriangle
} from 'lucide-react'
import { useSelector } from 'react-redux'
import type { Task } from '../store/tasksSlice'
import type { RootState } from '../store'

interface TaskCardProps {
    task: Task
    onToggleStatus: (taskId: string) => void
    onEdit: (task: Task) => void
    onDelete: (taskId: string) => void
    onTogglePin: (task: Task) => void
    onAddSubtask: (taskId: string, title: string) => void
    onToggleSubtask: (taskId: string, subtaskId: string) => void
    onUpdateTitle?: (taskId: string, newTitle: string) => void
    onUpdateSubtaskTitle?: (taskId: string, subtaskId: string, newTitle: string) => void
    onDeleteSubtask?: (taskId: string, subtaskId: string) => void
    compact?: boolean
    isDark?: boolean
}

/**
 * 任务卡片组件
 * - 左侧优先级竖条
 * - 点击展开子任务
 * - 悬停显示操作按钮
 */
export const TaskCard: React.FC<TaskCardProps> = ({
    task,
    isDark = false,
    onToggleStatus,
    onEdit,
    onDelete,
    onTogglePin,
    onAddSubtask,
    onToggleSubtask,
    onUpdateTitle,
    onUpdateSubtaskTitle,
    onDeleteSubtask,
    compact = false
}) => {
    const performanceMode = useSelector((state: RootState) => state.settings.performanceMode)
    const themeConfig = useSelector((state: RootState) => state.settings.themeConfig)
    const [expanded, setExpanded] = useState(false)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

    // Inline editing state
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editTitleValue, setEditTitleValue] = useState(task.title)
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
    const [editSubtaskValue, setEditSubtaskValue] = useState('')

    // 优先级颜色映射 (竖条颜色)
    const priorityBarColors = {
        'very-low': 'bg-gray-400',
        low: 'bg-green-400',
        medium: 'bg-yellow-400',
        high: 'bg-red-500',
        'very-high': 'bg-red-800'
    }

    // 判断任务是否逾期：当前日期 > 截止日期 且 任务未完成
    const isOverdue = task.status !== 'done' && task.due_date && (() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dueDate = new Date(task.due_date)
        dueDate.setHours(0, 0, 0, 0)
        return today > dueDate
    })()

    // 根据是否置顶决定卡片的"明显程度"
    // 动态读取面板透明度设置
    const panelOpacity = themeConfig?.opacity?.panel ?? 60
    const pinnedOpacity = Math.min(panelOpacity + 20, 100) // 置顶卡片更明显
    const normalOpacity = Math.max(panelOpacity - 20, 10) // 普通卡片更透明
    const enableCardEffects = performanceMode === 'best'

    const cardStyleClass = task.is_pinned
        ? `border-white/50 dark:border-white/10 ${enableCardEffects ? 'shadow-lg hover:shadow-xl hover:-translate-y-0.5' : 'shadow-sm'}`
        : `border-white/10 dark:border-white/5 shadow-none ${enableCardEffects ? 'hover:border-white/30 hover:shadow-sm' : ''}`

    // 根据性能模式确定CardBgStyle
    // 极简模式：纯色背景，最佳/普通模式：带调节的透明度
    const getCardBgStyle = () => {
        const opacity = task.is_pinned ? pinnedOpacity : normalOpacity
        if (performanceMode === 'lite') {
            // 极简模式：纯色背景，完全不透明
            return { backgroundColor: isDark ? '#1f2937' : '#ffffff' }
        }
        // 最佳/普通模式：毛玻璃效果 + 动态透明度
        return {
            backgroundColor: isDark
                ? `rgba(31, 41, 55, ${opacity / 100})`
                : `rgba(255, 255, 255, ${opacity / 100})`
        }
    }
    const cardBgStyle = getCardBgStyle()

    const handleCardClick = () => {
        setExpanded(!expanded)
    }

    const handleSubmitSubtask = () => {
        if (newSubtaskTitle.trim()) {
            onAddSubtask(task.id, newSubtaskTitle)
            setNewSubtaskTitle('')
        }
    }

    const handleToggleStatus = (e: React.MouseEvent) => {
        e.stopPropagation()
        onToggleStatus(task.id)
    }

    // Inline title editing handlers
    const handleTitleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onUpdateTitle) {
            setEditTitleValue(task.title)
            setIsEditingTitle(true)
        }
    }

    const handleTitleSubmit = () => {
        if (editTitleValue.trim() && editTitleValue !== task.title && onUpdateTitle) {
            onUpdateTitle(task.id, editTitleValue.trim())
        }
        setIsEditingTitle(false)
    }

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleTitleSubmit()
        else if (e.key === 'Escape') {
            setEditTitleValue(task.title)
            setIsEditingTitle(false)
        }
    }

    // Inline subtask editing handlers
    const handleSubtaskDoubleClick = (e: React.MouseEvent, st: { id: string, title: string }) => {
        e.stopPropagation()
        if (onUpdateSubtaskTitle) {
            setEditSubtaskValue(st.title)
            setEditingSubtaskId(st.id)
        }
    }

    const handleSubtaskSubmit = (subtaskId: string) => {
        if (editSubtaskValue.trim() && onUpdateSubtaskTitle) {
            onUpdateSubtaskTitle(task.id, subtaskId, editSubtaskValue.trim())
        }
        setEditingSubtaskId(null)
    }

    const handleSubtaskKeyDown = (e: React.KeyboardEvent, subtaskId: string) => {
        if (e.key === 'Enter') handleSubtaskSubmit(subtaskId)
        else if (e.key === 'Escape') setEditingSubtaskId(null)
    }

    // Handle Copy Completed Subtasks
    const handleCopySubtasks = (e: React.MouseEvent) => {
        e.stopPropagation()
        const completed = task.subtasks?.filter(st => st.completed) || []
        if (completed.length === 0) return

        const text = completed.map(st => `- [x] ${st.title}`).join('\n')
        navigator.clipboard.writeText(text).then(() => {
            // Copy succeeded
        }).catch(err => {
            console.error('Failed to copy: ', err)
        })
    }

    const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0
    const totalSubtasks = task.subtasks?.length || 0
    const hasCompletedSubtasks = completedSubtasks > 0

    // 根据性能模式决定是否启用blur
    const blurClass = performanceMode === 'best' ? 'backdrop-blur-md' : ''

    return (
        <div
            className={`
        relative ${blurClass} border cursor-pointer group transition-all duration-200 overflow-hidden flex flex-col
        ${cardStyleClass}
        ${compact ? 'px-2 py-1.5 rounded-xl' : 'p-3 mb-3 rounded-xl'}
      `}
            style={cardBgStyle}
            onClick={handleCardClick}
        >
            {/* 优先级竖条 (左侧) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityBarColors[task.priority]}`}></div>

            <div className={`flex items-center w-full overflow-hidden ${compact ? 'gap-2.5 pl-2' : 'gap-3 pl-2'}`}>
                {/* 勾选框 */}
                <div
                    className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
                    onClick={handleToggleStatus}
                >
                    {task.status === 'done' ? (
                        <CheckCircle size={compact ? 16 : 20} className="text-blue-600 dark:text-blue-500" />
                    ) : (
                        <Circle size={compact ? 16 : 20} />
                    )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 w-full min-w-0">
                        {isEditingTitle ? (
                            <input
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                onBlur={handleTitleSubmit}
                                onKeyDown={handleTitleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className={`font-medium bg-white/80 dark:bg-gray-700 border border-blue-400 rounded px-1 outline-none focus:ring-1 focus:ring-blue-400 w-full dark:text-gray-100 ${compact ? 'text-sm py-0.5' : ''}`}
                                autoFocus
                            />
                        ) : (
                            <span
                                className={`flex-1 w-0 block truncate text-gray-800 dark:text-gray-200 ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : ''} ${compact ? 'text-sm' : 'font-medium'}`}
                                onDoubleClick={handleTitleDoubleClick}
                                title={task.title}
                            >
                                {task.title}
                            </span>
                        )}
                        {/* 置顶图标 */}
                        {task.is_pinned && <Pin size={compact ? 12 : 12} className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400 rotate-45 shrink-0" />}
                        {/* 子任务进度 - 在 compact 模式下内联显示 */}
                        {compact && totalSubtasks > 0 && (
                            <span className="text-[10px] text-gray-400 shrink-0">
                                {completedSubtasks}/{totalSubtasks}
                            </span>
                        )}
                    </div>

                    {/* 描述 - 仅在非 compact 模式 */}
                    {!compact && task.description && (
                        <div className="text-xs text-gray-500/80 dark:text-gray-400/80 mt-1 line-clamp-2">
                            {task.description}
                        </div>
                    )}

                    {/* 逾期标识 - 显示在描述下方 */}
                    {isOverdue && (
                        <div className="flex items-center gap-1 mt-1" title="已逾期">
                            <AlertTriangle size={compact ? 10 : 12} className="text-red-500 fill-red-100" />
                            <span className="text-[10px] text-red-500 font-medium">已逾期</span>
                        </div>
                    )}

                    {/* 跨天任务日期范围显示 - 只在真正的多日任务时显示 */}
                    {task.start_date && task.due_date && (() => {
                        const startDateOnly = task.start_date.split('T')[0]
                        const dueDateOnly = task.due_date.split('T')[0]
                        if (startDateOnly === dueDateOnly) return null
                        return (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                                    {startDateOnly.slice(5).replace('-', '/')} - {dueDateOnly.slice(5).replace('-', '/')}
                                </span>
                            </div>
                        )
                    })()}

                    {/* 子任务进度 - 非 compact 模式 */}
                    {!compact && (totalSubtasks > 0 || expanded) && (
                        <div className="flex items-center gap-2 mt-2">
                            <div
                                className={`
                  flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full select-none transition-colors
                  ${expanded ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-500/10 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'}
                `}
                            >
                                <span>{completedSubtasks}/{totalSubtasks}</span>
                                {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 子任务列表展开区域 */}
            {expanded && (
                <div className="mt-3 pl-9 pr-2 animate-slide-in">
                    {task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-1 mb-2">
                            {task.subtasks.map(st => (
                                <div
                                    key={st.id}
                                    className="flex items-start gap-2 group/subtask py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Priority indicator */}
                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityBarColors[st.priority || 'low']}`}></div>
                                    <div
                                        className={`
                      mt-0.5 w-3 h-3 rounded-[3px] border flex items-center justify-center cursor-pointer transition-colors shrink-0
                      ${st.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-500 bg-white/40 dark:bg-white/10 hover:border-blue-400'}
                    `}
                                        onClick={() => onToggleSubtask(task.id, st.id)}
                                    >
                                        {st.completed && <Check size={8} className="text-white stroke-[3]" />}
                                    </div>
                                    {editingSubtaskId === st.id ? (
                                        <input
                                            type="text"
                                            value={editSubtaskValue}
                                            onChange={(e) => setEditSubtaskValue(e.target.value)}
                                            onBlur={() => handleSubtaskSubmit(st.id)}
                                            onKeyDown={(e) => handleSubtaskKeyDown(e, st.id)}
                                            className="text-xs flex-1 bg-white/80 dark:bg-gray-700 border border-blue-400 rounded px-1 outline-none dark:text-gray-100"
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <span
                                                className={`text-xs leading-tight cursor-text block ${st.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'}`}
                                                onDoubleClick={(e) => handleSubtaskDoubleClick(e, st)}
                                                title={st.title}
                                            >
                                                {st.title}
                                            </span>
                                            {st.description && (
                                                <span className="text-[10px] text-gray-400 block truncate" title={st.description}>
                                                    {st.description}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {/* Action buttons - show on hover */}
                                    <div className="opacity-0 group-hover/subtask:opacity-100 transition-opacity flex gap-0.5 shrink-0">
                                        <button
                                            className="p-0.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-500"
                                            onClick={() => onDeleteSubtask?.(task.id, st.id)}
                                            title="删除子任务"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 新增子任务输入区 */}
                    <div
                        className="flex items-center gap-2 pt-1 border-t border-gray-500/10 dark:border-gray-500/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Plus size={12} className="text-gray-400" />
                        <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmitSubtask()}
                            placeholder="回车添加子任务..."
                            className="flex-1 bg-transparent border-none outline-none text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                    </div>
                </div>
            )}

            {/* 悬停操作栏 */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                {/* Copy Completed Subtasks Button (always visible on hover, disabled if none) */}
                {!compact && totalSubtasks > 0 && (
                    <button
                        className={`p-1 rounded mr-1 ${hasCompletedSubtasks ? 'hover:bg-blue-50 hover:text-blue-600 text-gray-400' : 'text-gray-300 cursor-not-allowed'}`}
                        onClick={handleCopySubtasks}
                        title={hasCompletedSubtasks ? "复制已完成子任务" : "无已完成子任务"}
                        disabled={!hasCompletedSubtasks}
                    >
                        <Copy size={14} />
                    </button>
                )}
                <button
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-600/50 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    title="编辑任务"
                >
                    <Edit3 size={14} />
                </button>
                <button
                    className={`p-1 hover:bg-white/50 dark:hover:bg-gray-600/50 rounded ${task.is_pinned ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(task); }}
                    title={task.is_pinned ? "取消置顶" : "置顶任务"}
                >
                    <Pin size={14} className={task.is_pinned ? "fill-current" : ""} />
                </button>
                <button
                    className="p-1 hover:bg-red-400/50 hover:text-red-900 dark:hover:text-red-300 rounded text-gray-600 dark:text-gray-400"
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    title="删除任务"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}

export default TaskCard
