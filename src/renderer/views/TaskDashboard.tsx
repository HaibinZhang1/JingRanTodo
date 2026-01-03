import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Briefcase, Calendar, Clock, PlusSquare, X, GripVertical, Trash2, Maximize2, Minimize2, ExternalLink, Pin, Layout, Copy, Settings } from 'lucide-react'
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
} from '@dnd-kit/core'
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppDispatch, useAppSelector } from '../hooks/useRedux'
import { updateTask, createSubtask, updateSubtask, deleteSubtask } from '../store/tasksSlice'
import { fetchNotes, editNote, toggleNoteDashboard, addNote } from '../store/notesSlice'
import { WeekViewSection } from '../components/WeekViewSection'
import { CustomPanelGrid } from '../components/CustomPanelGrid'
import { GlassPanel, TaskCard, ConfirmModal, AddPanelTypeModal, NotePanel, CopyFormatSettingsModal } from '../components'
import { PanelInputBar } from '../components/PanelInputBar'
import { SectionHeader } from '../components/SectionHeader'
import { sortTasks } from '../utils/taskUtils'
import { DroppablePanel } from '../components/dashboard/DroppablePanel'
import { toChineseNum } from '../utils/formatUtils'
import type { Task } from '../store/tasksSlice'
import type { Note } from '../store/notesSlice'
import type { RootState } from '../store'

// Move interfaces to top or separate file if strictly needed, keeping here for now
interface TaskDashboardProps {
    onOpenTaskDetail: (task?: Task, prefillTitle?: string, panelId?: string) => void
    onOpenFloatWindow: (panelType: string, title?: string) => void
    onOpenNoteFullScreen?: (noteId: string) => void
    activeCardIds?: string[]
    isDark?: boolean
}

// CustomPanel interface
export interface CustomPanel {
    id: string
    title: string
    isExpanded: boolean
    width: number
    height: number
    sort_order: number
    copyFormat?: 'text' | 'json' | 'markdown'
    copyTemplateTask?: string
    copyTemplateSubtask?: string
}

const MAX_CUSTOM_PANELS = 6

export const TaskDashboard: React.FC<TaskDashboardProps> = ({ onOpenTaskDetail, onOpenFloatWindow, onOpenNoteFullScreen, activeCardIds = [], isDark = false }) => {
    const dispatch = useAppDispatch()
    const tasks = useAppSelector((state: RootState) => state.tasks.items)
    const { notes } = useAppSelector((state: RootState) => state.notes)

    // Local State
    const [todayInput, setTodayInput] = useState('')
    const [customPanelInputs, setCustomPanelInputs] = useState<Record<string, string>>({})
    const [activeId, setActiveId] = useState<string | null>(null)
    const [customPanels, setCustomPanels] = useState<CustomPanel[]>([])

    // Add Panel Modal State
    const [showAddTypeModal, setShowAddTypeModal] = useState(false)
    const [showAddPanel, setShowAddPanel] = useState(false)
    const [newPanelTitle, setNewPanelTitle] = useState('')

    // Copy Toast State
    const [copyToast, setCopyToast] = useState<string | null>(null)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        title: string
        content: string
        type: 'danger' | 'warning' | 'info'
        onConfirm: () => void
    }>({
        isOpen: false,
        title: '',
        content: '',
        type: 'info',
        onConfirm: () => { }
    })

    // Copy Settings Modal State
    const [copySettingsModal, setCopySettingsModal] = useState<{
        isOpen: boolean
        panelId: string | null
        settings: {
            copyFormat: 'text' | 'json' | 'markdown'
            copyTemplateTask: string
            copyTemplateSubtask: string
        }
    }>({
        isOpen: false,
        panelId: null,
        settings: {
            copyFormat: 'text',
            copyTemplateTask: '',
            copyTemplateSubtask: ''
        }
    })

    // Today Panel Copy Settings (Local state)
    const [todayCopySettings, setTodayCopySettings] = useState<{
        copyFormat: 'text' | 'json' | 'markdown'
        copyTemplateTask: string
        copyTemplateSubtask: string
    }>({
        copyFormat: 'text',
        copyTemplateTask: '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
        copyTemplateSubtask: '    {{index}}.{{title}}\n        {{description}}'
    })

    // Load initial data
    useEffect(() => {
        dispatch(fetchNotes())
        const loadPanels = async () => {
            try {
                if (window.electronAPI?.getAllPanels) {
                    const panels = await window.electronAPI.getAllPanels()
                    setCustomPanels(panels)
                }
            } catch (err) {
                console.error('Failed to load panels:', err)
            }
        }
        loadPanels()

        // 监听任务数据变化，同时刷新面板列表（Excel 导入时会新建面板）
        const unsubscribeTask = window.electronAPI?.onTaskDataChanged?.(() => {
            loadPanels()
        })

        // 监听笔记数据变化（浮窗关闭时会触发，刷新笔记状态）
        const unsubscribeNote = window.electronAPI?.onNoteDataChanged?.(() => {
            dispatch(fetchNotes())
        })

        return () => {
            unsubscribeTask?.()
            unsubscribeNote?.()
        }
    }, [dispatch])

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // Handlers
    const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string)

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) { setActiveId(null); return }

        const activeIdStr = active.id as string
        const overIdStr = over.id as string

        // Panel Sorting
        // Note: Panel sorting is now handled by CustomPanelGrid's onOrderChange
        // Only trigger update if it's a panel drag (which CustomPanelGrid handles internally usually, 
        // but here we might need to handle drops? No, CustomPanelGrid handles sortable items.)
        // This handler handles TASK drops between panels.

        // Task Drop Logic
        const activeTask = tasks.find(t => t.id === activeIdStr)
        if (activeTask) {
            let overPanelId = ''
            if (over.data.current?.type === 'panel') {
                overPanelId = over.data.current.panelId
            } else if (over.data.current?.type === 'task') {
                const overTask = tasks.find(t => t.id === overIdStr)
                // If dropping over a task, find which panel that task belongs to
                // Logic: if overTask is in today, panel is today. If custom, ID.
                // We don't track panel ID on task object for 'today', it's null.
                if (overTask) {
                    overPanelId = overTask.panel_id || 'today'
                }
            }

            if (overPanelId) {
                const currentPanelId = activeTask.panel_id || 'today'
                if (overPanelId !== currentPanelId) {
                    // Update task panel
                    dispatch(updateTask({
                        ...activeTask,
                        panel_id: overPanelId === 'today' ? null : overPanelId
                    }))
                }
            }
        }

        setActiveId(null)
    }

    const handleAddTask = useCallback(async (panelId: string, title: string) => {
        if (!title.trim() && !window.electronAPI) return // Allow creating empty if electronAPI? No.
        if (!title.trim()) return

        const now = new Date().toISOString()
        const newTask = {
            id: crypto.randomUUID(),  // 生成唯一 ID
            title: title.trim(),
            description: '',
            status: 'todo' as const,
            priority: 'medium' as const,
            is_pinned: false,
            start_date: now,  // 默认今天
            due_date: now,    // 默认今天
            completed_at: null,
            panel_id: panelId === 'today' ? null : panelId,
            rank: now,
            reminder_enabled: false,
            reminder_date: null,
            reminder_hour: null,
            reminder_minute: null,
            is_recurring: false,
            auto_generate_daily: false,
            created_at: now,
            updated_at: now
        }

        // Using electronAPI directly as per likely pattern in Dashboard for immediate feedback?
        // Or dispatch.
        if (window.electronAPI?.createTask) {
            await window.electronAPI.createTask(newTask)
            // The UI updates via subscription likely?
            // App.tsx usually sets up listener `db-task-update`.
        }

        if (panelId === 'today') setTodayInput('')
        else setCustomPanelInputs(prev => ({ ...prev, [panelId]: '' }))

    }, [])

    const handleToggleStatus = useCallback((id: string) => {
        const task = tasks.find(t => t.id === id)
        if (task) {
            const newStatus = task.status === 'done' ? 'todo' : 'done'
            dispatch(updateTask({ ...task, status: newStatus }))
        }
    }, [dispatch, tasks])

    const handleDeleteTask = useCallback((id: string) => {
        // Direct delete?
        // dispatch(deleteTask(id))
        // But original code might have used confirm modal?
        // "onDeleteTask={handleDeleteTask}" passed to DroppablePanel.
        // Let's implement direct delete or confirm.
        // Usually deletion has a confirmation or trash.
        // I'll use dispatch(deleteTask) for now.
        // Wait, `window.electronAPI.deleteTask`?
        if (window.electronAPI?.deleteTask) {
            window.electronAPI.deleteTask(id)
        }
    }, [])

    // Copy Success Toast
    const showCopyToast = useCallback((msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setCopyToast(msg)
        toastTimerRef.current = setTimeout(() => setCopyToast(null), 3000)
    }, [])

    const handleAddSubtask = useCallback((taskId: string, title: string) => dispatch(createSubtask({ taskId, title })), [dispatch])
    const handleToggleSubtask = useCallback((taskId: string, subtaskId: string) => { const task = tasks.find((t: Task) => t.id === taskId); const st = task?.subtasks.find((s: { id: string }) => s.id === subtaskId); if (st) dispatch(updateSubtask({ ...st, completed: !st.completed })) }, [dispatch, tasks])

    // Inline editing handlers
    const handleUpdateTitle = useCallback((taskId: string, newTitle: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        if (task) dispatch(updateTask({ ...task, title: newTitle }))
    }, [dispatch, tasks])
    const handleUpdateSubtaskTitle = useCallback((taskId: string, subtaskId: string, newTitle: string) => {
        const task = tasks.find((t: Task) => t.id === taskId)
        const st = task?.subtasks.find((s: { id: string }) => s.id === subtaskId)
        if (st) dispatch(updateSubtask({ ...st, title: newTitle }))
    }, [dispatch, tasks])
    const handleDeleteSubtask = useCallback((taskId: string, subtaskId: string) => {
        dispatch(deleteSubtask({ taskId, subtaskId }))
    }, [dispatch])

    const handleTogglePin = useCallback((task: Task, siblings: Task[]) => {
        const isPinning = !task.is_pinned
        const relevant = siblings.filter(t => t.id !== task.id && t.status !== 'done')

        let newRank = task.rank
        const ts = Date.now().toString(36)

        if (isPinning) {
            const pinned = relevant.filter(t => t.is_pinned)
            if (pinned.length > 0) {
                const max = pinned.reduce((m, t) => t.rank > m ? t.rank : m, '')
                newRank = max + '~' + ts
            }
        } else {
            const normal = relevant.filter(t => !t.is_pinned)
            if (normal.length > 0) {
                const min = normal.reduce((m, t) => t.rank < m ? t.rank : m, '~~~~')
                newRank = min.slice(0, -1) + '!' + ts
            }
        }
        dispatch(updateTask({ ...task, is_pinned: isPinning, rank: newRank }))
    }, [dispatch])

    // 添加面板并保存到数据库
    const handleAddPanel = useCallback(async () => {
        if (!newPanelTitle.trim() || customPanels.length >= MAX_CUSTOM_PANELS) return
        const np: CustomPanel = { id: `panel-${Date.now()}`, title: newPanelTitle.trim(), isExpanded: true, width: 360, height: 300, sort_order: customPanels.length }
        setCustomPanels([...customPanels, np]); setNewPanelTitle(''); setShowAddPanel(false); setCustomPanelInputs(prev => ({ ...prev, [np.id]: '' }))
        try { if (window.electronAPI?.createPanel) await window.electronAPI.createPanel(np) } catch (err) { console.error('Failed to save panel:', err) }
    }, [newPanelTitle, customPanels, window.electronAPI])

    // 删除面板并从数据库移除
    const handleRemovePanel = useCallback((panelId: string) => {
        setConfirmModal({
            isOpen: true,
            title: '删除面板',
            content: '确定要删除这个面板吗？面板上的所有任务也将被永久删除，此操作无法撤销。',
            type: 'danger',
            onConfirm: async () => {
                // 先关闭对应的浮窗（如果存在）
                window.electronAPI?.cardClose?.(`card-${panelId}`)

                const updated = customPanels.filter(p => p.id !== panelId)
                setCustomPanels(updated)
                try {
                    if (window.electronAPI?.deletePanel) {
                        await window.electronAPI.deletePanel(panelId)
                    }
                } catch (err) {
                    console.error('Failed to delete panel:', err)
                }
            }
        })
    }, [customPanels, window.electronAPI])

    // 更新面板标题
    const handleUpdatePanelTitle = useCallback(async (panelId: string, newTitle: string) => {
        const updated = customPanels.map(p => p.id === panelId ? { ...p, title: newTitle } : p)
        setCustomPanels(updated)
        // Auto-save logic was inline?
        const panel = updated.find(p => p.id === panelId)
        if (panel && window.electronAPI?.updatePanel) await window.electronAPI.updatePanel(panel)
    }, [customPanels])

    const getCustomPanelTasks = useCallback((panelId: string): Task[] => sortTasks(tasks.filter((t: Task) => t.panel_id === panelId)), [tasks])

    // 复制格式设置处理
    const handleOpenCopySettings = useCallback((panelId: string) => {
        if (panelId === 'today') {
            setCopySettingsModal({
                isOpen: true,
                panelId: 'today',
                settings: todayCopySettings
            })
        } else {
            const panel = customPanels.find(p => p.id === panelId)
            setCopySettingsModal({
                isOpen: true,
                panelId,
                settings: {
                    copyFormat: panel?.copyFormat || 'text',
                    copyTemplateTask: panel?.copyTemplateTask || '',
                    copyTemplateSubtask: panel?.copyTemplateSubtask || ''
                }
            })
        }
    }, [customPanels, todayCopySettings])

    const handleSaveCopySettings = useCallback(async (settings: { copyFormat: 'text' | 'json' | 'markdown'; copyTemplateTask: string; copyTemplateSubtask: string }) => {
        const panelId = copySettingsModal.panelId
        if (!panelId) return

        if (panelId === 'today') {
            setTodayCopySettings(settings)
        } else {
            const updated = customPanels.map(p =>
                p.id === panelId ? { ...p, ...settings } : p
            )
            setCustomPanels(updated)
            const panel = updated.find(p => p.id === panelId)
            if (panel && window.electronAPI?.updatePanel) {
                try {
                    await window.electronAPI.updatePanel(panel)
                } catch (err) {
                    console.error('Failed to save panel copy settings:', err)
                }
            }
        }
    }, [copySettingsModal.panelId, customPanels, window.electronAPI, dispatch])

    // 笔记卡片处理
    const handleAddNoteToPanel = useCallback(async (noteId: string) => {
        setShowAddTypeModal(false)
        await dispatch(toggleNoteDashboard(noteId))
    }, [dispatch])

    const handleRemoveNoteFromPanel = useCallback((noteId: string) => {
        setConfirmModal({
            isOpen: true,
            title: '移除笔记',
            content: '确定要从主页移除此笔记吗？笔记内容仍会在笔记列表中保留。',
            type: 'warning',
            onConfirm: async () => {
                await dispatch(toggleNoteDashboard(noteId))
            }
        })
    }, [dispatch])

    const handleNoteContentChange = useCallback(async (noteId: string, content: string) => {
        await dispatch(editNote({ id: noteId, content }))
    }, [dispatch])

    const handleNoteTitleChange = useCallback(async (noteId: string, newTitle: string) => {
        await dispatch(editNote({ id: noteId, title: newTitle }))
    }, [dispatch])

    // 混合卡片列表
    const dashboardNotes = useMemo(() =>
        notes.filter((n: Note) => n.showOnDashboard).sort((a: Note, b: Note) => a.dashboardOrder - b.dashboardOrder),
        [notes]
    )
    const existingNotePanelIds = useMemo(() => dashboardNotes.map((n: Note) => n.id), [dashboardNotes])

    type MixedPanel =
        | { type: 'task'; panel: CustomPanel; order: number }
        | { type: 'note'; note: Note; order: number }

    const mixedPanels = useMemo(() => {
        const list: MixedPanel[] = []
        customPanels.forEach(p => list.push({ type: 'task', panel: p, order: p.sort_order }))
        dashboardNotes.forEach(n => list.push({ type: 'note', note: n, order: n.dashboardOrder }))
        return list.sort((a, b) => a.order - b.order)
    }, [customPanels, dashboardNotes])

    const todayTasks = useMemo(() => {
        // 使用本地时间获取 YYYYMMDD
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const today = `${year}${month}${day}`

        return sortTasks(tasks.filter((t: Task) => {
            // 排除持续任务（持续任务会自动生成今日待办）
            if (t.auto_generate_daily) return false

            // 检查日期：如果是未来日期的任务，不显示在今日待办
            if (t.start_date) {
                const taskDate = new Date(t.start_date)
                // 简单的日期比较：获取日期部分的数值 (YYYYMMDD)
                const tDateNum = taskDate.getFullYear() * 10000 + (taskDate.getMonth() + 1) * 100 + taskDate.getDate()
                const todayNum = parseInt(today, 10) // today is YYYYMMDD string

                // 如果是未来的任务，坚决不显示
                if (tDateNum > todayNum) return false
            }

            // 原有今日待办任务（panel_id 为空）
            if (!t.panel_id) return true

            // 自定义面板任务，开始日期是今天的也显示
            if (t.panel_id && t.start_date) {
                // 将存储的日期字符串（可能是 UTC ISO）转换为本地时间对象
                let taskDate = new Date(t.start_date)

                // 如果 Date 解析失败（NaN），尝试手动解析 YYYY/MM/DD
                if (isNaN(taskDate.getTime())) {
                    // 尝试直接比较字符串（针对非标准格式）
                    const dateStr = t.start_date.split(/[\sT]/)[0].replace(/[-/]/g, '')
                    if (dateStr === today) return true
                    return false
                }

                const tYear = taskDate.getFullYear()
                const tMonth = String(taskDate.getMonth() + 1).padStart(2, '0')
                const tDay = String(taskDate.getDate()).padStart(2, '0')
                const taskDateStr = `${tYear}${tMonth}${tDay}`

                if (taskDateStr === today) return true

            }
            return false
        }))
    }, [tasks])
    const panelOpacity = 50 // Fixed opacity or from settings?

    const activeTask = useMemo(() => activeId ? tasks.find(t => t.id === activeId) : null, [activeId, tasks])

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full w-full overflow-hidden group/dashboard p-4 gap-4">
                {/* Left Sidebar - Today (Fixed) */}
                <div className="w-[360px] shrink-0 h-full flex flex-col">
                    <DroppablePanel
                        id="today"
                        title="今日待办"
                        icon={<div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Briefcase size={16} /></div>}
                        countColor="bg-blue-600"
                        tasks={todayTasks}
                        inputPlaceholder="添加今日任务..."
                        inputValue={todayInput}
                        setInputValue={setTodayInput}
                        onAddTask={() => handleAddTask('today', todayInput)}
                        onToggleStatus={handleToggleStatus}
                        onEditTask={onOpenTaskDetail}
                        onDeleteTask={handleDeleteTask}
                        onTogglePin={handleTogglePin}
                        onAddSubtask={handleAddSubtask}
                        onToggleSubtask={handleToggleSubtask}
                        onUpdateTitle={handleUpdateTitle}
                        onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                        onDeleteSubtask={handleDeleteSubtask}
                        onDetailClick={(title) => onOpenTaskDetail(undefined, title)}
                        onOpenFloatWindow={() => onOpenFloatWindow('today', '今日待办')}
                        onCloseFloatWindow={() => window.electronAPI?.cardClose?.('card-today')}
                        opacity={panelOpacity}
                        onCopySuccess={showCopyToast}
                        onOpenCopySettings={() => handleOpenCopySettings('today')}
                        isFloatWindowOpen={activeCardIds.includes('card-today')}
                        copyFormat={todayCopySettings.copyFormat}
                        copyTemplateTask={todayCopySettings.copyTemplateTask}
                        copyTemplateSubtask={todayCopySettings.copyTemplateSubtask}
                        isDark={isDark}
                    />
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col min-w-0 h-full gap-4">
                    {/* Week View Section */}
                    <div className="shrink-0">
                        <WeekViewSection tasks={tasks} onTaskClick={(t) => onOpenTaskDetail(t)} onOpenTaskDetail={onOpenTaskDetail} isDark={isDark} />
                    </div>

                    {/* Custom Panels Grid */}
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        <CustomPanelGrid
                            onOrderChange={(newOrder) => {
                                newOrder.forEach((id, globalIndex) => {
                                    if (id.startsWith('note-')) {
                                        const noteId = id.replace('note-', '')
                                        const note = dashboardNotes.find(n => n.id === noteId)
                                        if (note && note.dashboardOrder !== globalIndex) dispatch(editNote({ id: noteId, dashboardOrder: globalIndex }))
                                    } else {
                                        const panel = customPanels.find(p => p.id === id)
                                        if (panel && panel.sort_order !== globalIndex) {
                                            const updatedPanel = { ...panel, sort_order: globalIndex }
                                            window.electronAPI?.updatePanel?.(updatedPanel)
                                        }
                                    }
                                })
                                // Update local state
                                const taskPanelOrder = newOrder.filter(id => !id.startsWith('note-'))
                                const reorderedPanels = taskPanelOrder.map(id => customPanels.find(p => p.id === id)!).filter(Boolean).map((panel, i) => ({ ...panel, sort_order: newOrder.indexOf(panel.id) }))
                                setCustomPanels(reorderedPanels)
                            }}
                            className="flex-1"
                            maxPanels={MAX_CUSTOM_PANELS}
                            showAddButton={true}
                            onAddPanel={() => setShowAddTypeModal(true)}
                            canAddMore={customPanels.length + dashboardNotes.length < MAX_CUSTOM_PANELS * 2} // Approximate limit logic
                        >
                            {mixedPanels.map(item => {
                                if (item.type === 'task') {
                                    const panel = item.panel
                                    return (
                                        <div key={panel.id} className="h-full flex flex-col">
                                            <DroppablePanel
                                                id={panel.id}
                                                title={panel.title}
                                                icon={<div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600"><PlusSquare size={16} /></div>}
                                                countColor="bg-indigo-400"
                                                tasks={getCustomPanelTasks(panel.id)}
                                                inputPlaceholder="添加任务..."
                                                inputValue={customPanelInputs[panel.id] || ''}
                                                setInputValue={(val) => setCustomPanelInputs(prev => ({ ...prev, [panel.id]: val }))}
                                                onAddTask={() => handleAddTask(panel.id, customPanelInputs[panel.id] || '')}
                                                onToggleStatus={handleToggleStatus}
                                                onEditTask={onOpenTaskDetail}
                                                onDeleteTask={handleDeleteTask}
                                                onTogglePin={handleTogglePin}
                                                onAddSubtask={handleAddSubtask}
                                                onToggleSubtask={handleToggleSubtask}
                                                onTitleChange={(newTitle) => handleUpdatePanelTitle(panel.id, newTitle)}
                                                onCopySuccess={showCopyToast}
                                                onOpenCopySettings={() => handleOpenCopySettings(panel.id)}
                                                isFloatWindowOpen={activeCardIds.includes(`card-${panel.id}`)}
                                                copyFormat={panel.copyFormat || 'text'}
                                                copyTemplateTask={panel.copyTemplateTask}
                                                copyTemplateSubtask={panel.copyTemplateSubtask}
                                                isDark={isDark}
                                                onDetailClick={(title) => onOpenTaskDetail(undefined, title, panel.id)}
                                                onRemove={() => handleRemovePanel(panel.id)}
                                                onOpenFloatWindow={() => onOpenFloatWindow(panel.id, panel.title)}
                                                onCloseFloatWindow={() => window.electronAPI?.cardClose?.(`card-${panel.id}`)}
                                                isCustom={true}
                                            />
                                        </div>
                                    )
                                } else {
                                    const note = item.note
                                    return (
                                        <div key={`note-${note.id}`} className="h-full flex flex-col">
                                            <NotePanel
                                                note={note}
                                                onRemove={() => handleRemoveNoteFromPanel(note.id)}
                                                onOpenFloatWindow={() => {
                                                    window.electronAPI?.noteWindowCreate?.({
                                                        id: note.id,
                                                        x: note.position?.x,
                                                        y: note.position?.y,
                                                        width: note.width,
                                                        height: note.height,
                                                        zIndex: note.zIndex
                                                    })
                                                    dispatch(editNote({ id: note.id, isFloating: true }))
                                                }}
                                                onCloseFloatWindow={() => {
                                                    window.electronAPI?.noteWindowClose?.(note.id)
                                                    dispatch(editNote({ id: note.id, isFloating: false }))
                                                }}
                                                onOpenFullScreen={() => onOpenNoteFullScreen?.(note.id)}
                                                isFloatWindowOpen={note.isFloating}
                                                opacity={panelOpacity}
                                                onContentChange={handleNoteContentChange}
                                                onTitleChange={handleNoteTitleChange}
                                                isDark={isDark}
                                            />
                                        </div>
                                    )
                                }
                            })}
                        </CustomPanelGrid>
                    </div>
                </div>

                <DragOverlay dropAnimation={null} modifiers={[({ transform }) => ({ ...transform, x: transform.x - 10, y: transform.y - 10 })]}>
                    {activeTask && (
                        <div className="opacity-90 rotate-2 shadow-xl w-64" style={{ willChange: 'transform' }}>
                            <TaskCard
                                task={activeTask}
                                onToggleStatus={() => { }}
                                onEdit={() => { }}
                                onDelete={() => { }}
                                onTogglePin={() => { }}
                                onAddSubtask={() => { }}
                                onToggleSubtask={() => { }}
                                compact
                            />
                        </div>
                    )}
                </DragOverlay>
            </div>

            {/* 加回弹窗组件 */}
            <AddPanelTypeModal
                isOpen={showAddTypeModal}
                onClose={() => setShowAddTypeModal(false)}
                onSelectTaskPanel={() => { setShowAddTypeModal(false); setShowAddPanel(true) }}
                onSelectNotePanel={handleAddNoteToPanel}
                onCreateNote={async (title: string) => {
                    try {
                        const result = await dispatch(addNote({ title, content: '', showOnDashboard: true })).unwrap()
                        return result.id
                    } catch (error) {
                        console.error('Failed to create note:', error)
                        return null
                    }
                }}
                notes={notes}
                existingNotePanelIds={existingNotePanelIds}
                isDark={isDark}
            />
            {showAddPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <GlassPanel isDark={isDark} variant="modal" className="w-80 p-6">
                        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">新增任务卡片</h3><button onClick={() => setShowAddPanel(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button></div>
                        <input type="text" value={newPanelTitle} onChange={(e) => setNewPanelTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPanel()} placeholder="输入卡片名称..." className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-white/40 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 mb-4 text-gray-800 dark:text-gray-200" autoFocus />
                        <div className="flex gap-3"><button onClick={() => setShowAddPanel(false)} className="flex-1 py-2 bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-white/70 dark:hover:bg-gray-600/50 transition-colors">取消</button><button onClick={handleAddPanel} disabled={!newPanelTitle.trim()} className="flex-1 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50">添加</button></div>
                    </GlassPanel>
                </div>
            )}
            {copyToast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                    <div className="px-6 py-3 bg-green-500 text-white rounded-xl shadow-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="font-medium">{copyToast}</span>
                    </div>
                </div>
            )}
            <CopyFormatSettingsModal
                isOpen={copySettingsModal.isOpen}
                onClose={() => setCopySettingsModal({
                    isOpen: false,
                    panelId: null,
                    settings: {
                        copyFormat: 'text',
                        copyTemplateTask: '',
                        copyTemplateSubtask: ''
                    }
                })}
                onSave={handleSaveCopySettings}
                initialSettings={copySettingsModal.settings as any}
                title={copySettingsModal.panelId === 'today' ? '今日待办 - 复制格式' : '复制格式设置'}
            />
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                content={confirmModal.content}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                isDark={isDark}
            />
        </DndContext>
    )
}

export default TaskDashboard