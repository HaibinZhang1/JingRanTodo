import React, { useRef, useEffect, useState } from 'react'
import { X, Edit2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Task } from '../store/tasksSlice'
import { format } from 'date-fns'

interface TaskPreviewCardProps {
    task: Task
    position: { x: number; y: number }
    onClose: () => void
    onEdit: () => void
    onToggleStatus: () => void
}

const getPriorityLabel = (priority: string): { label: string; color: string } => {
    const map: Record<string, { label: string; color: string }> = {
        'very-low': { label: '极低', color: 'bg-gray-100 text-gray-600' },
        'low': { label: '低', color: 'bg-green-100 text-green-700' },
        'medium': { label: '中', color: 'bg-yellow-100 text-yellow-700' },
        'high': { label: '高', color: 'bg-red-100 text-red-700' },
        'very-high': { label: '极高', color: 'bg-red-200 text-red-800' }
    }
    return map[priority] || { label: '中', color: 'bg-gray-100 text-gray-600' }
}

export const TaskPreviewCard: React.FC<TaskPreviewCardProps> = ({
    task,
    position,
    onClose,
    onEdit,
    onToggleStatus
}) => {
    const cardRef = useRef<HTMLDivElement>(null)
    const [adjustedPosition, setAdjustedPosition] = useState(position)

    // 调整位置避免超出视窗
    useEffect(() => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            let x = position.x
            let y = position.y

            // 右边超出
            if (x + rect.width > viewportWidth - 20) {
                x = viewportWidth - rect.width - 20
            }
            // 下边超出
            if (y + rect.height > viewportHeight - 20) {
                y = position.y - rect.height - 10
            }
            // 左边超出
            if (x < 20) x = 20
            // 上边超出
            if (y < 20) y = 20

            setAdjustedPosition({ x, y })
        }
    }, [position])

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    const priorityInfo = getPriorityLabel(task.priority)
    const isCompleted = task.status === 'done'
    const subtasks = task.subtasks || []
    const completedSubtasks = subtasks.filter(st => st.completed).length

    return (
        <div
            ref={cardRef}
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
        >
            {/* Header */}
            <div className={`px-3 py-2 flex items-start justify-between gap-2 ${isCompleted ? 'bg-gray-50' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                <h3 className={`text-sm font-semibold flex-1 ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {task.title}
                </h3>
                <button
                    onClick={onClose}
                    className="p-0.5 rounded hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="px-3 py-2 space-y-2">
                {/* 描述 */}
                {task.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                )}

                {/* 元信息 */}
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {/* 优先级 */}
                    <span className={`px-1.5 py-0.5 rounded ${priorityInfo.color}`}>
                        {priorityInfo.label}优先级
                    </span>

                    {/* 状态 */}
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isCompleted ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {isCompleted ? '已完成' : '进行中'}
                    </span>
                </div>

                {/* 日期信息 */}
                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[10px] text-gray-500">
                    {task.start_date && task.due_date && (() => {
                        // 只在真正的多日任务时显示开始日期
                        const startDateOnly = task.start_date.split('T')[0]
                        const dueDateOnly = task.due_date.split('T')[0]
                        if (startDateOnly === dueDateOnly) return null
                        return (
                            <div className="flex items-center gap-1">
                                <Clock size={10} />
                                开始: {format(new Date(task.start_date), 'MM-dd')}
                            </div>
                        )
                    })()}
                    {task.due_date && (
                        <div className="flex items-center gap-1">
                            <AlertCircle size={10} />
                            截止: {format(new Date(task.due_date), 'MM-dd')}
                        </div>
                    )}
                    {task.reminder_time && (
                        <div className="flex items-center gap-1">
                            <Clock size={10} />
                            提醒: {task.reminder_time.includes('T')
                                ? format(new Date(task.reminder_time), 'HH:mm')
                                : task.reminder_time.substring(0, 5)}
                        </div>
                    )}
                </div>

                {/* 子任务详情 */}
                {subtasks.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                            <span>子任务</span>
                            <span className="text-blue-600">{completedSubtasks}/{subtasks.length}</span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {subtasks.map((st, idx) => (
                                <div
                                    key={st.id || idx}
                                    className={`flex items-center gap-1.5 text-[10px] ${st.completed ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                    <span className={`shrink-0 w-3 h-3 rounded border flex items-center justify-center ${st.completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                                        {st.completed && <span className="text-[8px]">✓</span>}
                                    </span>
                                    <span className={`truncate ${st.completed ? 'line-through' : ''}`}>{st.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
                <button
                    onClick={onToggleStatus}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${isCompleted
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                >
                    {isCompleted ? '标记未完成' : '✓ 标记完成'}
                </button>
                <button
                    onClick={onEdit}
                    className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                >
                    <Edit2 size={10} />
                    编辑
                </button>
            </div>
        </div>
    )
}
