import React, { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { getToday, formatDateForInput } from '../../utils/dateUtils'
import { SubtaskItem } from './SubtaskItem'
import { validateSubtaskDates, getDefaultReminderTime } from '../../utils/validationUtils'
import type { Subtask } from '../../store/tasksSlice'

interface SubtaskListProps {
    subtasks: (Subtask | Omit<Subtask, 'id' | 'task_id' | 'order'>)[]
    pendingSubtaskUpdates: Record<string, Partial<Subtask>>
    onUpdateSubtask: (index: number, id: string | undefined, updates: Partial<Subtask>) => void
    onDeleteSubtask: (id: string | undefined, index: number) => void
    onAddSubtask: (subtask: Omit<Subtask, 'id' | 'task_id' | 'order'>) => void
    // 父任务日期范围 - 用于验证子任务日期
    parentStartDate?: string
    parentStartHour?: number
    parentStartMinute?: number
    parentDueDate?: string
    parentDueHour?: number
    parentDueMinute?: number
}

const priorityColors: Record<string, string> = {
    'very-low': 'bg-gray-400',
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
    'very-high': 'bg-red-800'
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
    subtasks,
    pendingSubtaskUpdates,
    onUpdateSubtask,
    onDeleteSubtask,
    onAddSubtask,
    parentStartDate,
    parentStartHour,
    parentStartMinute,
    parentDueDate,
    parentDueHour,
    parentDueMinute
}) => {
    const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null)
    const subtasksEndRef = useRef<HTMLDivElement>(null)

    // 添加表单展开状态
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false)

    // New Subtask Form State
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
    const [newSubtaskPriority, setNewSubtaskPriority] = useState<'very-low' | 'low' | 'medium' | 'high' | 'very-high'>('low')
    const [newSubtaskDescription, setNewSubtaskDescription] = useState('')

    // 日期时间状态
    const [newStartDate, setNewStartDate] = useState('')
    const [newStartHour, setNewStartHour] = useState(9)
    const [newStartMinute, setNewStartMinute] = useState(0)
    const [newDueDate, setNewDueDate] = useState('')
    const [newDueHour, setNewDueHour] = useState(18)
    const [newDueMinute, setNewDueMinute] = useState(0)

    // 提醒状态
    const [newReminderEnabled, setNewReminderEnabled] = useState(false)
    const [newReminderDate, setNewReminderDate] = useState('')
    const [newReminderHour, setNewReminderHour] = useState(9)
    const [newReminderMinute, setNewReminderMinute] = useState(0)

    // 当展开表单时，如果没有设置日期，默认填充父任务的日期或今天
    useEffect(() => {
        if (isAddFormExpanded) {
            // 默认日期逻辑：优先使用父任务日期，否则使用今天
            const defaultDate = formatDateForInput(parentStartDate) || getToday()

            if (!newStartDate) {
                setNewStartDate(defaultDate)
                // 如果父任务有具体时间，使用父任务时间；否则使用默认 9:00
                if (parentStartHour !== undefined) setNewStartHour(parentStartHour)
                if (parentStartMinute !== undefined) setNewStartMinute(parentStartMinute)
            }

            if (!newDueDate) {
                // 截止日期跟随着开始日期或父任务截止日期
                const defaultDue = formatDateForInput(parentDueDate) || defaultDate
                setNewDueDate(defaultDue)
                // 如果父任务有具体时间，使用父任务时间；否则使用默认 18:00
                if (parentDueHour !== undefined) setNewDueHour(parentDueHour)
                if (parentDueMinute !== undefined) setNewDueMinute(parentDueMinute)
            }
        }
    }, [isAddFormExpanded, parentStartDate, parentStartHour, parentStartMinute, parentDueDate, parentDueHour, parentDueMinute])

    // 日期验证：
    // 1. 子任务日期必须在父任务范围内
    // 2. 子任务开始日期必须 <= 截止日期
    const validation = validateSubtaskDates(
        newStartDate, newStartHour, newStartMinute,
        newDueDate, newDueHour, newDueMinute,
        parentStartDate, parentDueDate
    )

    const resetForm = () => {
        setNewSubtaskTitle('')
        setNewSubtaskPriority('low')
        setNewSubtaskDescription('')
        // 重置日期，下次展开时重新获取父任务日期
        setNewStartDate('')
        setNewStartHour(9)
        setNewStartMinute(0)
        setNewDueDate('')
        setNewDueHour(18)
        setNewDueMinute(0)
        setNewReminderEnabled(false)
        setNewReminderDate('')
        setNewReminderHour(9)
        setNewReminderMinute(0)
        setIsAddFormExpanded(false)
    }

    const handleAdd = () => {
        if (!newSubtaskTitle.trim()) return
        if (!validation.isValid) return

        const newSubtask: Omit<Subtask, 'id' | 'task_id' | 'order'> = {
            title: newSubtaskTitle.trim(),
            priority: newSubtaskPriority,
            description: newSubtaskDescription.trim() || undefined,
            completed: false,
            start_date: newStartDate || undefined,
            start_hour: newStartDate ? newStartHour : undefined,
            start_minute: newStartDate ? newStartMinute : undefined,
            due_date: newDueDate || undefined,
            due_hour: newDueDate ? newDueHour : undefined,
            due_minute: newDueDate ? newDueMinute : undefined,
            reminder_enabled: newReminderEnabled,
            reminder_date: newReminderEnabled ? newReminderDate : undefined,
            reminder_hour: newReminderEnabled ? newReminderHour : undefined,
            reminder_minute: newReminderEnabled ? newReminderMinute : undefined
        }

        onAddSubtask(newSubtask)
        resetForm()

        // Scroll to bottom
        setTimeout(() => {
            subtasksEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 50)
    }

    return (
        <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-3 mt-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <span className="text-gray-400">📋</span> 子任务
            </label>
            <div className="space-y-1 mb-2">
                {subtasks.map((st, idx) => {
                    const id = 'id' in st ? st.id : undefined
                    const subtaskKey = id || `pending-${idx}`
                    const isExpanded = expandedSubtaskId === subtaskKey
                    const pendingUpdate = id ? pendingSubtaskUpdates[id] : undefined
                    const displayPriority = pendingUpdate?.priority || st.priority || 'low'
                    const displayDescription = pendingUpdate?.description ?? st.description ?? ''

                    return (
                        <SubtaskItem
                            key={subtaskKey}
                            subtask={st}
                            index={idx}
                            isExpanded={isExpanded}
                            onExpand={() => setExpandedSubtaskId(isExpanded ? null : subtaskKey)}
                            onDelete={() => onDeleteSubtask(id, idx)}
                            onUpdate={(updates) => onUpdateSubtask(idx, id, updates)}
                            displayPriority={displayPriority}
                            displayDescription={displayDescription}
                            parentStartDate={parentStartDate}
                            parentDueDate={parentDueDate}
                        />
                    )
                })}
                <div ref={subtasksEndRef} />
            </div>

            {/* Add subtask form */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 flex flex-col overflow-hidden transition-all duration-300">
                <div className="p-3 pb-0">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-2">
                        <Plus size={16} className="text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && newSubtaskTitle.trim() && !isAddFormExpanded && handleAdd()}
                            placeholder="子任务标题..."
                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm placeholder-gray-400 outline-none focus:border-blue-400 dark:text-gray-200"
                        />
                        <button
                            onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
                            className={`p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${isAddFormExpanded ? 'bg-gray-200 dark:bg-gray-700 rounded' : ''}`}
                            title={isAddFormExpanded ? '收起详情' : '展开详情'}
                        >
                            <ChevronDown size={16} className={`transition-transform ${isAddFormExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* 简洁模式：只显示优先级 */}
                    {!isAddFormExpanded && (
                        <div className="flex items-center gap-4 pl-6 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">优先级</span>
                                <div className="flex gap-1">
                                    {(['very-low', 'low', 'medium', 'high', 'very-high'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setNewSubtaskPriority(p)}
                                            className={`w-4 h-4 rounded-full border-2 ${priorityColors[p]} ${newSubtaskPriority === p ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-50 hover:opacity-100'} transition-all`}
                                            title={p}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 展开详情模式 */}
                    {isAddFormExpanded && (
                        <div className="space-y-3 pl-6 pt-2 border-t border-gray-200/50 dark:border-gray-600/50 mt-2 mb-3">
                            {/* 优先级 */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">优先级</span>
                                <div className="flex gap-1">
                                    {(['very-low', 'low', 'medium', 'high', 'very-high'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setNewSubtaskPriority(p)}
                                            className={`w-5 h-5 rounded-full border-2 ${priorityColors[p]} ${newSubtaskPriority === p ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-50 hover:opacity-100'} transition-all`}
                                            title={p}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* 描述 */}
                            <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 w-16 pt-1">描述</span>
                                <textarea
                                    value={newSubtaskDescription}
                                    onChange={(e) => setNewSubtaskDescription(e.target.value)}
                                    placeholder="添加描述..."
                                    className="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-400 resize-none dark:text-gray-200 dark:placeholder-gray-500"
                                    rows={2}
                                />
                            </div>

                            {/* 开始日期时间 */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">开始</span>
                                <input
                                    type="date"
                                    value={formatDateForInput(newStartDate)}
                                    min={formatDateForInput(parentStartDate)}
                                    max={formatDateForInput(parentDueDate)}
                                    onChange={(e) => setNewStartDate(e.target.value)}
                                    className={`text-xs bg-white dark:bg-gray-800 border rounded px-2 py-1 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark ${newStartDate && !validation.isValid && validation.message?.includes('开始') ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                                />
                                {newStartDate && (
                                    <>
                                        <select
                                            value={newStartHour}
                                            onChange={(e) => setNewStartHour(parseInt(e.target.value))}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-1 outline-none focus:border-blue-400 w-14 dark:text-gray-200"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <span className="text-xs text-gray-400">:</span>
                                        <select
                                            value={newStartMinute}
                                            onChange={(e) => setNewStartMinute(parseInt(e.target.value))}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-1 outline-none focus:border-blue-400 w-14 dark:text-gray-200"
                                        >
                                            {Array.from({ length: 60 }, (_, i) => (
                                                <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* 截止日期时间 */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">截止</span>
                                <input
                                    type="date"
                                    value={formatDateForInput(newDueDate)}
                                    min={formatDateForInput(parentStartDate)}
                                    max={formatDateForInput(parentDueDate)}
                                    onChange={(e) => setNewDueDate(e.target.value)}
                                    className={`text-xs bg-white dark:bg-gray-800 border rounded px-2 py-1 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark ${newDueDate && !validation.isValid && validation.message?.includes('截止') ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                                />
                                {newDueDate && (
                                    <>
                                        <select
                                            value={newDueHour}
                                            onChange={(e) => setNewDueHour(parseInt(e.target.value))}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-1 outline-none focus:border-blue-400 w-14 dark:text-gray-200"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <span className="text-xs text-gray-400">:</span>
                                        <select
                                            value={newDueMinute}
                                            onChange={(e) => setNewDueMinute(parseInt(e.target.value))}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-1 outline-none focus:border-blue-400 w-14 dark:text-gray-200"
                                        >
                                            {Array.from({ length: 60 }, (_, i) => (
                                                <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* 错误信息显示 */}
                            {!validation.isValid && validation.message && (
                                <div className="text-xs text-red-500 pl-16">
                                    {validation.message}
                                </div>
                            )}

                            {/* 提醒设置 */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">提醒</span>
                                <button
                                    onClick={() => {
                                        const newEnabled = !newReminderEnabled
                                        setNewReminderEnabled(newEnabled)
                                        if (newEnabled && !newReminderDate) {
                                            const defaultTime = getDefaultReminderTime(newStartDate, newStartHour, newStartMinute)
                                            setNewReminderDate(defaultTime.date)
                                            setNewReminderHour(defaultTime.hour)
                                            setNewReminderMinute(defaultTime.minute)
                                        }
                                    }}
                                    className={`relative w-8 h-4 rounded-full transition-colors ${newReminderEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${newReminderEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                </button>
                                {newReminderEnabled && (
                                    <div className="flex gap-1 items-center">
                                        <input
                                            type="date"
                                            value={formatDateForInput(newReminderDate)}
                                            onChange={(e) => setNewReminderDate(e.target.value)}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-28 dark:text-gray-200 dark:color-scheme-dark"
                                        />
                                        <select
                                            value={newReminderHour}
                                            onChange={(e) => setNewReminderHour(parseInt(e.target.value))}
                                            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-400 w-12 dark:text-gray-200"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i} className="dark:bg-gray-800">{String(i).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <span className="text-xs text-gray-400">:</span>
                                        <select
                                            value={newReminderMinute}
                                            onChange={(e) => setNewReminderMinute(parseInt(e.target.value))}
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

                {/* 底部融合的添加按钮 - 蓝色圆角风格 */}
                <div className="p-2 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-100/30 dark:bg-gray-800/30">
                    <button
                        onClick={handleAdd}
                        disabled={!newSubtaskTitle.trim() || !validation.isValid}
                        className="w-full py-1.5 flex items-center justify-center rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                        title="添加子任务"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
