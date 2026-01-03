import React from 'react'
import { X, ChevronDown, Calendar } from 'lucide-react'
import { validateDateRange, getDefaultReminderTime } from '../../utils/validationUtils'
import { formatDateForInput } from '../../utils/dateUtils'
import type { Subtask } from '../../store/tasksSlice'

interface SubtaskItemProps {
    subtask: Subtask | Omit<Subtask, 'id' | 'task_id' | 'order'>
    index: number
    isExpanded: boolean
    onExpand: () => void
    onDelete: () => void
    onUpdate: (updates: Partial<Subtask>) => void
    displayPriority: string
    displayDescription: string
    parentStartDate?: string
    parentDueDate?: string
}

const priorityColors: Record<string, string> = {
    'very-low': 'bg-gray-400',
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
    'very-high': 'bg-red-800'
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({
    subtask,
    index,
    isExpanded,
    onExpand,
    onDelete,
    onUpdate,
    displayPriority,
    displayDescription,
    parentStartDate,
    parentDueDate
}) => {
    const isStartDateValid = validateDateRange(subtask.start_date, parentStartDate, parentDueDate, '').isValid
    const isDueDateValid = validateDateRange(subtask.due_date, parentStartDate, parentDueDate, '').isValid

    // 格式化日期时间显示
    const formatDateTime = (date?: string, hour?: number, minute?: number) => {
        if (!date) return null
        const dateStr = date
        if (hour !== undefined && minute !== undefined) {
            return `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        }
        return dateStr
    }

    const startDateDisplay = formatDateTime(subtask.start_date, subtask.start_hour, subtask.start_minute)
    const dueDateDisplay = formatDateTime(subtask.due_date, subtask.due_hour, subtask.due_minute)

    const safeParentStartDate = formatDateForInput(parentStartDate)
    const safeParentDueDate = formatDateForInput(parentDueDate)

    return (
        <div className="border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-lg transition-colors">
            <div
                className="flex items-start gap-2 py-1 px-2 group cursor-pointer"
                onClick={onExpand}
            >
                {/* Priority indicator */}
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityColors[displayPriority]}`}></div>
                {/* Checkbox */}
                <div
                    className={`mt-0.5 w-4 h-4 border-[1.5px] rounded-[3px] mr-1 shrink-0 flex items-center justify-center ${subtask.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-500 bg-white/50 dark:bg-gray-700/50'}`}
                >
                    {subtask.completed && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                    <span className={`text-sm block ${subtask.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                        {subtask.title}
                    </span>
                    {/* 简洁模式下显示日期范围或描述 */}
                    {!isExpanded && (startDateDisplay || dueDateDisplay || displayDescription) && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                            {(startDateDisplay || dueDateDisplay) && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    {startDateDisplay && dueDateDisplay
                                        ? `${startDateDisplay} - ${dueDateDisplay}`
                                        : startDateDisplay || dueDateDisplay
                                    }
                                </span>
                            )}
                            {displayDescription && !(startDateDisplay || dueDateDisplay) && (
                                <span className="truncate">{displayDescription}</span>
                            )}
                        </div>
                    )}
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                    <X size={14} />
                </button>
            </div>
            {/* Expanded details */}
            {isExpanded && (
                <div className="px-3 pb-2 pt-1 space-y-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-lg" onClick={(e) => e.stopPropagation()}>
                    {/* Priority selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">优先级</span>
                        <div className="flex gap-1">
                            {(['very-low', 'low', 'medium', 'high', 'very-high'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => onUpdate({ priority: p })}
                                    className={`w-5 h-5 rounded-full border-2 ${priorityColors[p]} ${displayPriority === p ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-50 hover:opacity-100'} transition-all`}
                                    title={p}
                                />
                            ))}
                        </div>
                    </div>
                    {/* Description input */}
                    <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 pt-1">描述</span>
                        <textarea
                            value={displayDescription}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder="添加描述..."
                            className="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-400 resize-none dark:text-gray-200 dark:placeholder-gray-500"
                            rows={2}
                        />
                    </div>

                    {/* 开始日期时间 */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">开始</span>
                        <input
                            type="date"
                            value={formatDateForInput(subtask.start_date)}
                            min={safeParentStartDate}
                            max={safeParentDueDate}
                            onChange={(e) => onUpdate({
                                start_date: e.target.value || undefined,
                                start_hour: e.target.value ? (subtask.start_hour ?? 9) : undefined,
                                start_minute: e.target.value ? (subtask.start_minute ?? 0) : undefined
                            })}
                            className={`text-xs bg-white dark:bg-gray-800 border rounded px-1 py-0.5 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark ${isStartDateValid ? 'border-gray-200 dark:border-gray-600' : 'border-red-400'}`}
                        />
                        {subtask.start_date && (
                            <>
                                <select
                                    value={subtask.start_hour ?? 9}
                                    onChange={(e) => onUpdate({ start_hour: parseInt(e.target.value) })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-gray-400">:</span>
                                <select
                                    value={subtask.start_minute ?? 0}
                                    onChange={(e) => onUpdate({ start_minute: parseInt(e.target.value) })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {!isStartDateValid && <span className="text-xs text-red-500">超出范围</span>}
                    </div>

                    {/* 截止日期时间 */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">截止</span>
                        <input
                            type="date"
                            value={formatDateForInput(subtask.due_date)}
                            min={safeParentStartDate}
                            max={safeParentDueDate}
                            onChange={(e) => onUpdate({
                                due_date: e.target.value || undefined,
                                due_hour: e.target.value ? (subtask.due_hour ?? 18) : undefined,
                                due_minute: e.target.value ? (subtask.due_minute ?? 0) : undefined
                            })}
                            className={`text-xs bg-white dark:bg-gray-800 border rounded px-1 py-0.5 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark ${isDueDateValid ? 'border-gray-200 dark:border-gray-600' : 'border-red-400'}`}
                        />
                        {subtask.due_date && (
                            <>
                                <select
                                    value={subtask.due_hour ?? 18}
                                    onChange={(e) => onUpdate({ due_hour: parseInt(e.target.value) })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-gray-400">:</span>
                                <select
                                    value={subtask.due_minute ?? 0}
                                    onChange={(e) => onUpdate({ due_minute: parseInt(e.target.value) })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {!isDueDateValid && <span className="text-xs text-red-500">超出范围</span>}
                    </div>

                    {/* Reminder settings */}
                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12">提醒</span>
                        <button
                            onClick={() => {
                                const newEnabled = !subtask.reminder_enabled
                                let updates: Partial<Subtask> = {
                                    reminder_enabled: newEnabled,
                                    reminder_sent: false
                                }

                                if (newEnabled) {
                                    const defaultTime = getDefaultReminderTime(subtask.start_date, subtask.start_hour, subtask.start_minute)
                                    updates.reminder_date = defaultTime.date
                                    updates.reminder_hour = defaultTime.hour
                                    updates.reminder_minute = defaultTime.minute
                                } else {
                                    updates.reminder_date = undefined
                                    updates.reminder_hour = undefined
                                    updates.reminder_minute = undefined
                                }
                                onUpdate(updates)
                            }}
                            className={`relative w-8 h-4 rounded-full transition-colors ${subtask.reminder_enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${subtask.reminder_enabled ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                        </button>
                        {subtask.reminder_enabled && (
                            <div className="flex gap-1 items-center">
                                <input
                                    type="date"
                                    value={formatDateForInput(subtask.reminder_date)}
                                    onChange={(e) => onUpdate({ reminder_date: e.target.value, reminder_sent: false })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark"
                                />
                                <select
                                    value={subtask.reminder_hour ?? 9}
                                    onChange={(e) => onUpdate({ reminder_hour: parseInt(e.target.value), reminder_sent: false })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-gray-400">:</span>
                                <select
                                    value={subtask.reminder_minute ?? 0}
                                    onChange={(e) => onUpdate({ reminder_minute: parseInt(e.target.value), reminder_sent: false })}
                                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
