import React, { useMemo, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Copy, Settings, ExternalLink, Trash2 } from 'lucide-react'
import { GlassPanel } from '../GlassPanel'
import { SectionHeader } from '../SectionHeader'
import { PanelInputBar } from '../PanelInputBar'
import { SortableTaskCard } from './SortableTaskCard'
import { toChineseNum } from '../../utils/formatUtils'
import type { Task } from '../../store/tasksSlice'

export interface DroppablePanelProps {
    id: string
    title: string
    icon: React.ReactNode
    countColor: string
    tasks: Task[]
    inputPlaceholder?: string
    inputValue?: string
    setInputValue?: (v: string) => void
    onAddTask?: () => void
    onToggleStatus: (id: string) => void
    onEditTask: (t: Task) => void
    onDeleteTask: (id: string) => void
    onTogglePin: (t: Task, siblings: Task[]) => void
    onAddSubtask: (id: string, title: string) => void
    onToggleSubtask: (tid: string, sid: string) => void
    onUpdateTitle?: (id: string, title: string) => void
    onUpdateSubtaskTitle?: (tid: string, sid: string, title: string) => void
    onDeleteSubtask?: (tid: string, sid: string) => void
    onDetailClick?: (prefillTitle?: string) => void
    onRemove?: () => void
    onOpenFloatWindow?: () => void
    onCloseFloatWindow?: () => void
    opacity?: number
    compact?: boolean
    isCustom?: boolean
    isExpanded?: boolean
    onToggleExpand?: () => void
    headerColor?: string
    onDeletePanel?: () => void
    onTitleChange?: (newTitle: string) => void
    onCopySuccess?: (message: string) => void
    onOpenCopySettings?: () => void
    isFloatWindowOpen?: boolean
    copyFormat?: 'text' | 'json' | 'markdown'
    copyTemplateTask?: string
    copyTemplateSubtask?: string
    dragListeners?: any
    isDragging?: boolean
    isDark?: boolean
}

export const DroppablePanel: React.FC<DroppablePanelProps> = ({
    id, title, icon, countColor, tasks, inputPlaceholder, inputValue, setInputValue, onAddTask, onToggleStatus, onEditTask,
    onDeleteTask, onTogglePin, onAddSubtask, onToggleSubtask, onUpdateTitle, onUpdateSubtaskTitle, onDeleteSubtask, onDetailClick, onRemove, onOpenFloatWindow, onCloseFloatWindow, opacity = 50, compact = false, isCustom = false, isExpanded = true, onToggleExpand, headerColor, onTitleChange, onCopySuccess, onOpenCopySettings, isFloatWindowOpen = false, copyFormat = 'text',
    copyTemplateSubtask = '    {{index}}.{{title}}\n        {{description}}',
    copyTemplateTask = '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
    dragListeners,
    isDragging = false,
    isDark = false
}) => {
    const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'panel', panelId: id } })

    // 获取已完成任务
    const completedTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks])

    // 复制已完成任务
    const handleCopyCompletedTasks = useCallback(() => {
        if (completedTasks.length === 0) return

        let text = ''
        if (copyFormat === 'json') {
            text = JSON.stringify(completedTasks.map(t => ({
                title: t.title,
                description: t.description,
                subtasks: t.subtasks?.map(s => ({ title: s.title, description: s.description, completed: s.completed }))
            })), null, 2)
        } else if (copyFormat === 'markdown') {
            text = completedTasks.map(task => {
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
            // Text format (使用自定义模板)
            text = completedTasks.map((task, idx) => {
                let subtasksText = ''
                if (task.subtasks && task.subtasks.length > 0) {
                    subtasksText = task.subtasks.map((st, sIdx) => {
                        let stStr = copyTemplateSubtask
                            .replace(/{{index}}/g, (sIdx + 1).toString())
                            .replace(/{{title}}/g, st.title)
                            .replace(/{{description}}/g, st.description || '___EMPTY_FIELD___')
                            .replace(/{{completed}}/g, st.completed ? '[x]' : '[ ]')

                        // 按行处理，仅删除完全由空字段组成的行
                        return stStr.split('\n')
                            .filter(line => line.trim() !== '___EMPTY_FIELD___')
                            .join('\n')
                            .replace(/___EMPTY_FIELD___/g, '')
                    }).join('\n')
                }

                // 直接替换占位符，使用特殊标记处理空值
                let taskStr = copyTemplateTask
                    .replace(/{{chinese_index}}/g, toChineseNum(idx + 1))
                    .replace(/{{index}}/g, (idx + 1).toString())
                    .replace(/{{title}}/g, task.title)
                    .replace(/{{description}}/g, task.description || '___EMPTY_FIELD___')
                    .replace(/{{subtasks}}/g, subtasksText || '___EMPTY_FIELD___')

                // 按行过滤：如果一行只包含缩进和空值标记，则删除该行
                taskStr = taskStr.split('\n')
                    .filter(line => line.trim() !== '___EMPTY_FIELD___')
                    .join('\n')
                    .replace(/___EMPTY_FIELD___/g, '') // 兜底替换行内残留标记

                return taskStr
            }).join('\n')
        }

        navigator.clipboard.writeText(text).then(() => {
            onCopySuccess?.(`已复制 ${completedTasks.length} 个已完成任务`)
        }).catch(err => {
            console.error('Failed to copy:', err)
        })
    }, [completedTasks, copyFormat, copyTemplateTask, copyTemplateSubtask, onCopySuccess])

    return (
        <div className={`flex flex-col min-h-0 flex-1 min-w-[310px] transition-all duration-300 group/panel`}>
            <div ref={setNodeRef} className="flex-1 min-h-0 relative">
                <GlassPanel isDark={isDark} opacity={opacity} className={`h-full ${compact ? 'rounded-xl' : 'rounded-2xl'} flex flex-col overflow-hidden ${isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}>
                    {/* Integrated Header */}
                    <div
                        className={`flex items-center justify-between p-3 pb-2 shrink-0 border-b border-white/20 dark:border-gray-700/50 ${isCustom ? 'drag-handle cursor-move select-none' : ''} ${isDragging ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                        {...(isCustom && dragListeners ? dragListeners : {})}
                    >
                        <SectionHeader title={title} icon={icon} count={tasks.length} countColor={countColor} isEditable={isCustom} onTitleChange={onTitleChange} className="mb-0" />
                        <div className="flex items-center gap-1 opacity-0 group-hover/panel:opacity-100 transition-opacity">
                            {completedTasks.length > 0 && (
                                <>
                                    <button
                                        onClick={handleCopyCompletedTasks}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
                                        title={`复制已完成任务 (${completedTasks.length})`}
                                    >
                                        <Copy size={15} />
                                    </button>
                                    {onOpenCopySettings && (
                                        <button
                                            onClick={onOpenCopySettings}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
                                            title="复制设置"
                                        >
                                            <Settings size={15} />
                                        </button>
                                    )}
                                </>
                            )}
                            {onOpenFloatWindow && (
                                <button
                                    onClick={isFloatWindowOpen ? onCloseFloatWindow : onOpenFloatWindow}
                                    className={`p-1.5 rounded-lg transition-all relative ${isFloatWindowOpen ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                                    title={isFloatWindowOpen ? "关闭浮窗" : "开启浮窗"}
                                >
                                    <ExternalLink size={15} />
                                </button>
                            )}
                            {isCustom && onRemove && <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-400 hover:text-red-500 transition-colors" title="删除面板"><Trash2 size={15} /></button>}
                        </div>
                    </div>

                    <div className={`flex-1 overflow-y-auto ${compact ? 'p-2' : 'p-3'} week-scrollbar min-h-[60px]`}>
                        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            {tasks.length > 0 ? tasks.map(task => <SortableTaskCard key={task.id} task={task} onToggleStatus={onToggleStatus} onEdit={onEditTask} onDelete={onDeleteTask} onTogglePin={(t) => onTogglePin(t, tasks)} onAddSubtask={onAddSubtask} onToggleSubtask={onToggleSubtask} onUpdateTitle={onUpdateTitle} onUpdateSubtaskTitle={onUpdateSubtaskTitle} onDeleteSubtask={onDeleteSubtask} compact={compact} />)
                                : <div className="h-full flex items-center justify-center text-gray-400 text-xs py-4">拖拽任务到此处</div>}
                        </SortableContext>
                    </div>

                    {inputPlaceholder && inputValue !== undefined && setInputValue && onAddTask && (
                        <div className="border-t border-gray-200/30 dark:border-gray-700/30">
                            <PanelInputBar
                                placeholder={inputPlaceholder}
                                inputValue={inputValue}
                                setInputValue={setInputValue}
                                onAdd={onAddTask}
                                onDetailClick={onDetailClick}
                                compact={true}
                            />
                        </div>
                    )}
                </GlassPanel>
            </div>
        </div>
    )
}
