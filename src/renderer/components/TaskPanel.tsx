import React from 'react'
import { Copy } from 'lucide-react'
import GlassPanel from './GlassPanel'
import TaskCard from './TaskCard'
import PanelInputBar from './PanelInputBar'
import SectionHeader from './SectionHeader'
import type { Task } from '../store/tasksSlice'

interface TaskPanelProps {
    title: string
    icon: React.ReactNode
    countColor: string
    tasks: Task[]
    inputPlaceholder: string
    inputValue: string
    setInputValue: (val: string) => void
    onAddTask: () => void
    onToggleStatus: (taskId: string) => void
    onEditTask: (task: Task) => void
    onDeleteTask: (taskId: string) => void
    onSetReminder: (task: Task) => void
    onAddSubtask: (taskId: string, title: string) => void
    onToggleSubtask: (taskId: string, subtaskId: string) => void
    onUpdateSubtaskTitle?: (taskId: string, subtaskId: string, newTitle: string) => void
    onDeleteSubtask?: (taskId: string, subtaskId: string) => void
    onFloatClick?: () => void
    onDetailClick?: () => void
    onCopyTasks?: () => void
    opacity?: number
    compact?: boolean
    flexSize?: number
    onTogglePin: (task: Task) => void
}

/**
 * 任务卡片组件
 * 包含标题、输入栏、任务列表、复制按钮
 */
export const TaskPanel: React.FC<TaskPanelProps> = ({
    title,
    icon,
    countColor,
    tasks,
    inputPlaceholder,
    inputValue,
    setInputValue,
    onAddTask,
    onToggleStatus,
    onEditTask,
    onDeleteTask,
    onAddSubtask,
    onToggleSubtask,
    onFloatClick,
    onDetailClick,
    onCopyTasks,
    opacity = 50,
    compact = false,
    flexSize = 1,
    onTogglePin
}) => {
    return (
        <div className={`flex-[${flexSize}] flex flex-col gap-1 min-h-0`}>
            <SectionHeader
                title={title}
                icon={icon}
                count={tasks.length}
                countColor={countColor}
            />
            <GlassPanel
                variant="panel"
                className={`flex-1 ${compact ? 'rounded-xl' : 'rounded-2xl'} flex flex-col overflow-hidden group`}
            >
                <PanelInputBar
                    placeholder={inputPlaceholder}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onAdd={onAddTask}
                    onDetailClick={onDetailClick}
                />
                <div className={`flex-1 overflow-y-auto ${compact ? 'p-2' : 'p-3'} scrollbar-hide`}>
                    {tasks.length > 0 ? (
                        tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onToggleStatus={onToggleStatus}
                                onEdit={onEditTask}
                                onDelete={onDeleteTask}
                                onAddSubtask={onAddSubtask}
                                onToggleSubtask={onToggleSubtask}
                                onTogglePin={onTogglePin}
                                compact={compact}
                            />
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                            暂无任务
                        </div>
                    )}
                </div>
                {onCopyTasks && (
                    <button
                        onClick={onCopyTasks}
                        className={`
              ${compact ? 'p-1.5 text-[10px]' : 'p-2 text-xs'}
              w-full flex items-center justify-center gap-2 
              bg-white/40 hover:bg-white/60 text-gray-700 font-medium 
              border-t border-white/20 transition-all duration-300 
              opacity-0 group-hover:opacity-100
            `}
                    >
                        <Copy size={compact ? 10 : 12} /> 复制任务
                    </button>
                )}
            </GlassPanel>
        </div>
    )
}

export default TaskPanel
