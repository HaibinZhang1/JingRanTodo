import React, { useEffect, useState } from 'react'
import { useAppDispatch } from '../hooks/useRedux'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import {
    fetchRecurringTemplates,
    createRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
    setSelectedTemplate,
    RecurringTemplate,
    RecurringFrequency
} from '../store/recurringSlice'
import {
    CalendarClock, Plus, Trash2, ToggleLeft, ToggleRight,
    Calendar, Briefcase, Palmtree, Repeat, Clock, Bell

} from 'lucide-react'
import { getToday } from '../utils/dateUtils'
import { ConfirmModal, GlassPanel, InputModal } from '../components'

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'daily', label: '每天', icon: <Repeat size={24} />, desc: '每日重复' },
    { value: 'weekly', label: '每周', icon: <Calendar size={24} />, desc: '选择周几' },
    { value: 'monthly', label: '每月', icon: <Calendar size={24} />, desc: '选择日期' },
    { value: 'yearly', label: '每年', icon: <Calendar size={24} />, desc: '年度循环' },
    { value: 'workday', label: '工作日', icon: <Briefcase size={24} />, desc: '周一至周五' },
    { value: 'holiday', label: '休息日', icon: <Palmtree size={24} />, desc: '周末/节假日' }
]

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

interface RecurringTaskViewProps {
    isDark?: boolean
}

export default function RecurringTaskView({ isDark = false }: RecurringTaskViewProps) {
    const dispatch = useAppDispatch()
    const { templates, loading, selectedId } = useSelector((state: RootState) => state.recurring)
    const selectedTemplate = templates.find(t => t.id === selectedId) || null

    const [editForm, setEditForm] = useState<Partial<RecurringTemplate>>({})
    const [showSaved, setShowSaved] = useState(false)
    const [confirmConfig, setConfirmConfig] = useState({
        isOpen: false,
        title: '',
        content: '',
        onConfirm: () => { }
    })
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [renamingId, setRenamingId] = useState<string | null>(null)

    useEffect(() => {
        dispatch(fetchRecurringTemplates())
    }, [dispatch])

    useEffect(() => {
        if (selectedTemplate) {
            setEditForm({ ...selectedTemplate })
        } else {
            setEditForm({})
        }
    }, [selectedTemplate])

    const handleCreate = (title: string) => {
        if (title.trim()) {
            dispatch(createRecurringTemplate({
                title: title.trim(),
                frequency: 'daily',
                time: '09:00',
                enabled: true
            }))
        }
        setIsCreateModalOpen(false)
    }

    const isDirty = JSON.stringify(editForm) !== JSON.stringify(selectedTemplate)

    const saveChanges = () => {
        if (selectedTemplate && isDirty) {
            dispatch(updateRecurringTemplate({ ...selectedTemplate, ...editForm }))
            setShowSaved(true)
            setTimeout(() => setShowSaved(false), 2000)
        }
    }

    const handleCancel = () => {
        if (selectedTemplate) {
            setEditForm({ ...selectedTemplate })
        }
    }

    // Toggle enabled directly without requiring selection
    const handleToggleEnabled = (template: RecurringTemplate) => {
        dispatch(updateRecurringTemplate({ ...template, enabled: !template.enabled }))
    }

    const handleDelete = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: '删除规则',
            content: '确定删除此周期任务规则？删除后将不再自动生成任务。',
            onConfirm: () => {
                dispatch(deleteRecurringTemplate(id))
            }
        })
    }

    const toggleSelection = (arr: number[] | undefined, val: number): number[] => {
        const current = arr || []
        if (current.includes(val)) {
            return current.filter(v => v !== val).sort((a, b) => a - b)
        }
        return [...current, val].sort((a, b) => a - b)
    }

    const handleFrequencyChange = (freq: RecurringFrequency) => {
        const updates: Partial<RecurringTemplate> = { frequency: freq }
        if (freq === 'custom') {
            updates.intervalDays = 3
            updates.remindDayOffsets = [1]
            updates.startDate = getToday()
        } else if (freq === 'yearly') {
            // 每年频率需要设置 startDate 作为每年生成的日期参考
            updates.startDate = getToday()
        } else {
            updates.intervalDays = undefined
            updates.remindDayOffsets = undefined
        }
        setEditForm(prev => ({ ...prev, ...updates }))
    }

    return (
        <div className="flex-1 h-full p-6 flex gap-6 overflow-hidden">
            {/* Left Panel - Template List */}
            <div className="w-72 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <CalendarClock size={20} className="text-blue-600" />
                        周期任务
                    </h2>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                </div>



                <GlassPanel isDark={isDark} variant="panel" className="flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto scrollbar-hover scrollbar-stable p-2 space-y-1">
                        {loading ? (
                            <div className="text-center text-gray-400 py-4">加载中...</div>
                        ) : templates.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <CalendarClock size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">暂无周期任务</p>
                                <p className="text-xs mt-1">点击右上角 + 创建</p>
                            </div>
                        ) : (
                            templates.map(template => (
                                <div
                                    key={template.id}
                                    onClick={() => dispatch(setSelectedTemplate(template.id))}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedId === template.id
                                        ? 'bg-white dark:bg-gray-700/80 shadow-sm border-blue-200 dark:border-blue-500/30'
                                        : 'hover:bg-white/30 dark:hover:bg-gray-700/30 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${template.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-500'}`} />

                                        {renamingId === template.id ? (
                                            <input
                                                type="text"
                                                defaultValue={template.title}
                                                autoFocus
                                                className="flex-1 min-w-0 bg-white dark:bg-gray-800 border border-blue-400 rounded px-1 py-0.5 text-sm outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => {
                                                    const newTitle = e.target.value.trim()
                                                    if (newTitle && newTitle !== template.title) {
                                                        dispatch(updateRecurringTemplate({ ...template, title: newTitle }))
                                                    }
                                                    setRenamingId(null)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur()
                                                    } else if (e.key === 'Escape') {
                                                        setRenamingId(null)
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span
                                                className={`text-sm font-medium flex-1 truncate ${selectedId === template.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation()
                                                    setRenamingId(template.id)
                                                }}
                                                title={template.title}
                                            >
                                                {template.title}
                                            </span>
                                        )}

                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleEnabled(template) }}
                                            className={`p-1 rounded transition-colors ${template.enabled ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'}`}
                                            title={template.enabled ? "点击暂停" : "点击启用"}
                                        >
                                            {template.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(template.id) }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all transform hover:scale-110"
                                            title="删除规则"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 pl-4">
                                        {template.frequency === 'daily' && '每天'}
                                        {template.frequency === 'weekly' && `每周${(template.weekDays || []).map(d => WEEKDAY_LABELS[d - 1]).join('、')}`}
                                        {template.frequency === 'monthly' && `每月${(template.monthDays || []).join('、')}号`}
                                        {template.frequency === 'workday' && '工作日'}
                                        {template.frequency === 'holiday' && '休息日'}
                                        {template.frequency === 'yearly' && '每年'}
                                        {template.frequency === 'custom' && `每${template.intervalDays}天`}
                                        {' · '}{template.time}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GlassPanel>
            </div >

            {/* Right Panel - Editor */}
            < div className="flex-1 flex flex-col gap-4 h-full overflow-y-auto scrollbar-hover scrollbar-stable pr-2" >
                {
                    selectedTemplate ? (
                        <>
                            {/* Title Bar - matching left panel style (no background) */}
                            < div className="flex items-center justify-between px-2" >
                                <input
                                    type="text"
                                    value={editForm.title || ''}
                                    onChange={(e) => {
                                        setEditForm(prev => ({ ...prev, title: e.target.value }))
                                    }}
                                    className="bg-transparent text-xl font-bold text-gray-800 dark:text-gray-100 outline-none flex-1"
                                    placeholder="输入任务标题..."
                                />
                                {/* Action buttons - smaller height to match left panel */}
                                <div className="flex items-center bg-gray-100/50 dark:bg-gray-800/50 p-0.5 rounded-lg h-8">
                                    <button
                                        onClick={() => handleDelete(selectedTemplate.id)}
                                        className="h-full px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors flex items-center"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div >

                            {/* Frequency Selector */}
                            < GlassPanel isDark={isDark} variant="panel" className="p-6" >
                                <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4">重复频率</h3>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {FREQUENCY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleFrequencyChange(opt.value)}
                                            className={`p-4 rounded-xl border-2 text-center transition-all ${editForm.frequency === opt.value
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-gray-800/50'
                                                }`}
                                        >
                                            <div className="flex justify-center mb-2">{opt.icon}</div>
                                            <div className="text-sm font-bold">{opt.label}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>

                                {/* Custom Button */}
                                <button
                                    onClick={() => handleFrequencyChange('custom')}
                                    className={`w-full p-3 rounded-xl border-2 text-center transition-all ${editForm.frequency === 'custom'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-gray-800/50'
                                        }`}
                                >
                                    <span className="font-bold">自定义循环</span>
                                    <span className="text-xs text-gray-400 ml-2">例如：每3天、第1天提醒</span>
                                </button>

                                {/* Dynamic Config Area */}
                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    {/* Weekly: Weekday selector */}
                                    {editForm.frequency === 'weekly' && (
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">选择周几</h4>
                                            <div className="flex gap-2">
                                                {WEEKDAY_LABELS.map((label, idx) => {
                                                    const day = idx + 1
                                                    const selected = (editForm.weekDays || []).includes(day)
                                                    return (
                                                        <button
                                                            key={day}
                                                            onClick={() => {
                                                                const newDays = toggleSelection(editForm.weekDays, day)
                                                                setEditForm(prev => ({ ...prev, weekDays: newDays }))
                                                            }}
                                                            className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${selected
                                                                ? 'bg-blue-500 text-white shadow-md'
                                                                : 'bg-white/60 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                                }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Monthly: Day selector */}
                                    {editForm.frequency === 'monthly' && (
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">选择日期</h4>
                                            <div className="grid grid-cols-7 gap-2">
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                                    const selected = (editForm.monthDays || []).includes(day)
                                                    return (
                                                        <button
                                                            key={day}
                                                            onClick={() => {
                                                                const newDays = toggleSelection(editForm.monthDays, day)
                                                                setEditForm(prev => ({ ...prev, monthDays: newDays }))
                                                            }}
                                                            className={`h-8 rounded-lg font-medium text-xs transition-all ${selected
                                                                ? 'bg-blue-500 text-white shadow-md'
                                                                : 'bg-white/60 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                                }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Yearly: Date selector */}
                                    {editForm.frequency === 'yearly' && (
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">选择每年生成日期</h4>
                                            <input
                                                type="date"
                                                value={editForm.startDate || ''}
                                                onChange={(e) => {
                                                    setEditForm(prev => ({ ...prev, startDate: e.target.value }))
                                                }}
                                                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                            />
                                            <p className="text-xs text-gray-400 mt-2">任务将在每年的这一天自动生成</p>
                                        </div>
                                    )}

                                    {/* Custom: Interval & Remind Days */}
                                    {editForm.frequency === 'custom' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">每隔</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={365}
                                                    value={editForm.intervalDays || 3}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 3
                                                        setEditForm(prev => ({ ...prev, intervalDays: val }))
                                                    }}
                                                    className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg text-center outline-none focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                />
                                                <span className="text-sm text-gray-600 dark:text-gray-300">天重复一次</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">
                                                    选择提醒天数 (周期内第几天)
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {Array.from({ length: Math.min(editForm.intervalDays || 3, 31) }, (_, i) => i + 1).map(day => {
                                                        const selected = (editForm.remindDayOffsets || []).includes(day)
                                                        return (
                                                            <button
                                                                key={day}
                                                                onClick={() => {
                                                                    const newDays = toggleSelection(editForm.remindDayOffsets, day)
                                                                    setEditForm(prev => ({ ...prev, remindDayOffsets: newDays }))
                                                                }}
                                                                className={`w-10 h-10 rounded-full font-medium text-sm transition-all ${selected
                                                                    ? 'bg-blue-500 text-white shadow-md'
                                                                    : 'bg-white/60 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                                    }`}
                                                            >
                                                                {day}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">起始日期</span>
                                                <input
                                                    type="date"
                                                    value={editForm.startDate || ''}
                                                    onChange={(e) => {
                                                        setEditForm(prev => ({ ...prev, startDate: e.target.value }))
                                                    }}
                                                    className="px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </GlassPanel >

                            {/* Time Settings */}
                            < GlassPanel isDark={isDark} variant="panel" className="p-6" >
                                <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4">时间设置</h3>
                                <div className="flex flex-col gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                                            <Clock size={14} className="text-blue-500" /> 生成时间
                                        </label>
                                        <input
                                            type="time"
                                            value={editForm.time || '09:00'}
                                            onChange={(e) => {
                                                setEditForm(prev => ({ ...prev, time: e.target.value }))
                                            }}
                                            className="w-32 bg-white/60 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-gray-800 dark:text-gray-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-3">
                                            <Bell size={14} className="text-orange-500" /> 任务提醒
                                        </label>

                                        <div className="flex items-center gap-3 mb-3">
                                            <button
                                                onClick={() => {
                                                    if (editForm.reminderTime) {
                                                        setEditForm(prev => ({ ...prev, reminderTime: '' }))
                                                    } else {
                                                        setEditForm(prev => ({ ...prev, reminderTime: editForm.time || '09:00' }))
                                                    }
                                                }}
                                                className={`transform transition-transform active:scale-95`}
                                            >
                                                {editForm.reminderTime
                                                    ? <ToggleRight size={28} className="text-blue-500" />
                                                    : <ToggleLeft size={28} className="text-gray-300 dark:text-gray-600" />}
                                            </button>
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {editForm.reminderTime ? '开启提醒' : '关闭提醒'}
                                            </span>
                                        </div>

                                        {editForm.reminderTime && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 pl-1">
                                                <input
                                                    type="time"
                                                    value={editForm.reminderTime}
                                                    onChange={(e) => {
                                                        setEditForm(prev => ({ ...prev, reminderTime: e.target.value }))
                                                    }}
                                                    className="w-32 bg-white/60 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 text-gray-800 dark:text-gray-200"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* 紧急度 - 圆形色块 */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">紧急度</span>
                                        <div className="flex gap-2">
                                            {[
                                                { value: 'very-low', color: 'bg-gray-400' },
                                                { value: 'low', color: 'bg-green-500' },
                                                { value: 'medium', color: 'bg-yellow-500' },
                                                { value: 'high', color: 'bg-red-500' },
                                                { value: 'very-high', color: 'bg-red-800' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setEditForm(prev => ({ ...prev, priority: opt.value as any }))}
                                                    className={`w-6 h-6 rounded-full border-2 ${opt.color} ${(editForm.priority || 'medium') === opt.value ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-50 hover:opacity-100'} transition-all`}
                                                    title={opt.value}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </GlassPanel >

                            {/* Confirm Button */}
                            < div className="flex justify-end items-center gap-4" >
                                {showSaved && (
                                    <span className="text-green-600 dark:text-green-400 text-sm font-medium animate-pulse">✓ 已保存</span>
                                )
                                }
                                {
                                    isDirty && (
                                        <>
                                            <button
                                                onClick={handleCancel}
                                                className="px-6 py-2.5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 font-bold rounded-xl transition-all"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={saveChanges}
                                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
                                            >
                                                <CalendarClock size={18} />
                                                保存
                                            </button>
                                        </>
                                    )
                                }
                            </div >
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <CalendarClock size={48} className="mb-4 opacity-50" />
                            <p>选择或创建一个周期任务规则</p>
                        </div>
                    )}
            </div >


            <ConfirmModal
                isDark={isDark}
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                content={confirmConfig.content}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                type="danger"
                confirmText="删除"
            />

            <InputModal
                isDark={isDark}
                isOpen={isCreateModalOpen}
                title="新建周期任务"
                placeholder="请输入任务标题..."
                onConfirm={handleCreate}
                onCancel={() => setIsCreateModalOpen(false)}
                confirmText="创建"
            />
        </div >
    )
}
