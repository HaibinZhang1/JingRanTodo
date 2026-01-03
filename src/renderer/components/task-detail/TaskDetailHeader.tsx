import React from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface TaskDetailHeaderProps {
    isEditing: boolean
    isOverdue: boolean | undefined | null
    onClose: () => void
}

export const TaskDetailHeader: React.FC<TaskDetailHeaderProps> = ({
    isEditing,
    isOverdue,
    onClose
}) => {
    return (
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/20 dark:border-gray-700/50">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                {isEditing ? '编辑任务' : '新建任务'}
                {isOverdue && (
                    <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded flex items-center gap-1">
                        <AlertTriangle size={12} />
                        已逾期
                    </span>
                )}
            </h2>
            <button
                onClick={onClose}
                className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    )
}
