import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { TaskCard } from '../TaskCard'
import type { Task } from '../../store/tasksSlice'

interface SortableTaskCardProps {
    task: Task
    onToggleStatus: (id: string) => void
    onEdit: (t: Task) => void
    onDelete: (id: string) => void
    onTogglePin: (t: Task) => void
    onAddSubtask: (id: string, title: string) => void
    onToggleSubtask: (tid: string, sid: string) => void
    onUpdateTitle?: (id: string, title: string) => void
    onUpdateSubtaskTitle?: (tid: string, sid: string, title: string) => void
    onDeleteSubtask?: (tid: string, sid: string) => void
    compact?: boolean
}

// 使用 React.memo 避免不必要的重渲染
export const SortableTaskCard: React.FC<SortableTaskCardProps> = React.memo(({
    task,
    onToggleStatus,
    onEdit,
    onDelete,
    onTogglePin,
    onAddSubtask,
    onToggleSubtask,
    onUpdateTitle,
    onUpdateSubtaskTitle,
    onDeleteSubtask,
    compact
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        data: { task, type: 'task' }
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 50 : undefined
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div className="flex items-start gap-1">
                <div {...listeners} className="mt-3 cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical size={14} />
                </div>
                <div className="flex-1">
                    <TaskCard
                        task={task}
                        onToggleStatus={onToggleStatus}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onTogglePin={onTogglePin}
                        onAddSubtask={onAddSubtask}
                        onToggleSubtask={onToggleSubtask}
                        onUpdateTitle={onUpdateTitle}
                        onUpdateSubtaskTitle={onUpdateSubtaskTitle}
                        onDeleteSubtask={onDeleteSubtask}
                        compact={compact}
                    />
                </div>
            </div>
        </div>
    )
})

SortableTaskCard.displayName = 'SortableTaskCard'
