import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../hooks/useRedux'
import { fetchNotes, addNote, editNote, removeNote, toggleNoteFloat, toggleNotePin, toggleNoteDashboard, setPendingFullScreenId, Note } from '../store/notesSlice'
import { Search, Plus, Trash2, ExternalLink, Save, FileText, Pin, Eye, Edit3, List, Columns, Layout, Maximize2, Minimize2 } from 'lucide-react'
import { GlassPanel, ConfirmModal, InputModal } from '../components'
import MarkdownRenderer from '../components/MarkdownRenderer'
import MarkdownToolbar, { useMarkdownShortcuts } from '../components/MarkdownToolbar'

interface NotesViewProps {
    isDark?: boolean
    onExitFullScreen?: () => void
}

const NotesView: React.FC<NotesViewProps> = ({ isDark = false, onExitFullScreen }) => {
    const dispatch = useAppDispatch()
    const { notes, loading } = useAppSelector(state => state.notes)
    const { themeConfig } = useAppSelector(state => state.settings)

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Editor State
    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
    const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview' | 'dual'>('edit')

    const [isFullScreen, setIsFullScreen] = useState(false)
    const [fullScreenSource, setFullScreenSource] = useState<'board' | 'list' | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    // Renaming State
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renamingTitle, setRenamingTitle] = useState('')

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState({
        isOpen: false,
        title: '',
        content: '',
        onConfirm: () => { }
    })

    useEffect(() => {
        dispatch(fetchNotes())

        // Listen for external updates (e.g. from floating windows or other windows)
        const unsubscribe = window.electronAPI?.onNoteDataChanged?.(() => {
            dispatch(fetchNotes())
        })
        return () => unsubscribe?.()
    }, [dispatch])

    // Load selected note into editor
    useEffect(() => {
        if (selectedId) {
            const note = notes.find(n => n.id === selectedId)
            if (note) {
                setEditTitle(note.title)
                setEditContent(note.content)
                setSaveStatus('saved')
            }
        }
    }, [selectedId, notes])

    // Handle pending full screen request
    const pendingFullScreenId = useAppSelector(state => state.notes.pendingFullScreenId)
    useEffect(() => {
        if (pendingFullScreenId) {
            setSelectedId(pendingFullScreenId.id)
            setFullScreenSource(pendingFullScreenId.source || null)
            setIsFullScreen(true)
            dispatch(setPendingFullScreenId(null))
        }
    }, [pendingFullScreenId, dispatch])

    // Filter and sort notes (pinned first, then by updatedAt)
    const filteredNotes = notes
        .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            // Pinned notes first
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            // Then by updatedAt
            return b.updatedAt - a.updatedAt
        })

    // Auto-select note on page load: prefer last selected, fallback to first
    useEffect(() => {
        if (!selectedId && filteredNotes.length > 0) {
            // 优先恢复上次选择的笔记
            const lastSelectedId = localStorage.getItem('notes_last_selected_id')
            if (lastSelectedId && filteredNotes.some(n => n.id === lastSelectedId)) {
                setSelectedId(lastSelectedId)
            } else {
                setSelectedId(filteredNotes[0].id)
            }
        }
    }, [filteredNotes, selectedId])

    // 保存选择状态到localStorage
    useEffect(() => {
        if (selectedId) {
            localStorage.setItem('notes_last_selected_id', selectedId)
        }
    }, [selectedId])

    const handleTogglePin = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        await dispatch(toggleNotePin(id))
    }

    const handleCreateConfirm = async (title: string) => {
        const result = await dispatch(addNote({
            title: title || `未命名笔记_${Date.now().toString().slice(-4)}`,
            content: ''
        }))
        if (addNote.fulfilled.match(result)) {
            setSelectedId(result.payload.id)
        } else {
            console.error('Create note failed:', result.payload || result.error)
            alert('创建笔记失败: ' + (result.error?.message || '未知错误'))
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setConfirmConfig({
            isOpen: true,
            title: '删除笔记',
            content: '确定要删除这个笔记吗？删除后无法恢复。',
            onConfirm: async () => {
                await dispatch(removeNote(id))
                if (selectedId === id) setSelectedId(null)
            }
        })
    }

    const handleChangeContent = (val: string) => {
        setEditContent(val)
        setSaveStatus('unsaved')

        // Debounce save
        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        const timer = setTimeout(() => {
            if (selectedId) {
                setSaveStatus('saving')
                dispatch(editNote({ id: selectedId, content: val })).then(() => {
                    setSaveStatus('saved')
                })
            }
        }, 1000)
        setAutoSaveTimer(timer)
    }

    const handleTitleBlur = () => {
        if (selectedId && editTitle.trim()) {
            dispatch(editNote({ id: selectedId, title: editTitle }))
        }
    }

    // Markdown shortcuts hook
    const { handleKeyDown } = useMarkdownShortcuts(textareaRef, editContent, handleChangeContent)

    // Rename logic
    const handleRenameStart = (note: Note) => {
        setRenamingId(note.id)
        setRenamingTitle(note.title)
    }

    const handleRenameSubmit = async () => {
        if (renamingId && renamingTitle.trim()) {
            await dispatch(editNote({ id: renamingId, title: renamingTitle }))
        }
        setRenamingId(null)
    }

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit()
        } else if (e.key === 'Escape') {
            setRenamingId(null)
        }
    }

    const handleToggleFloat = async () => {
        if (selectedId) {
            try {
                const result = await dispatch(toggleNoteFloat(selectedId))
                if (result.meta.requestStatus === 'rejected') {
                    alert('开启浮窗失败: ' + ((result as any).error?.message || '未知错误'))
                }
            } catch (error) {
                console.error('Toggle float error:', error)
                alert('开启浮窗失败: ' + (error as any)?.message || '未知错误')
            }
        }
    }

    // 切换笔记在主页显示
    const handleToggleDashboard = async () => {
        if (selectedId) {
            try {
                await dispatch(toggleNoteDashboard(selectedId))
            } catch (error) {
                console.error('Toggle dashboard error:', error)
            }
        }
    }

    // Image drag and drop handler
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const files = Array.from(e.dataTransfer.files)
        const imageFiles = files.filter(f => f.type.startsWith('image/'))

        if (imageFiles.length === 0) return

        const textarea = textareaRef.current
        if (!textarea) return

        for (const file of imageFiles) {
            try {
                // Get file path (Electron provides this)
                const filePath = (file as any).path
                if (!filePath) {
                    console.warn('No file path available')
                    continue
                }

                // Save image and get relative path
                const relativePath = await (window as any).electronAPI?.saveNoteImage?.(filePath)
                if (!relativePath) continue

                // Focus textarea and use execCommand for undo support
                textarea.focus()
                const imageMarkdown = `![${file.name}](${relativePath})\n`
                document.execCommand('insertText', false, imageMarkdown)
            } catch (error) {
                console.error('Failed to save image:', error)
            }
        }
    }

    return (
        <div
            className={`flex-1 h-full flex gap-6 overflow-hidden transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-[100] p-6 backdrop-blur-md rounded-lg' : 'p-6'}`}
            style={isFullScreen ? {
                backgroundColor: isDark
                    ? `rgba(17, 24, 39, ${(themeConfig?.opacity?.panel || 90) / 100})`
                    : `rgba(243, 244, 246, ${(themeConfig?.opacity?.panel || 90) / 100})`
            } : undefined}
        >
            {/* Left Panel - Notes List */}
            <div className={`w-72 h-full flex flex-col gap-4 transition-all duration-300 ${isFullScreen ? '-ml-80 opacity-0 w-0' : ''}`}>
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        笔记列表
                    </h2>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <GlassPanel isDark={isDark} variant="panel" className="flex-1 overflow-hidden flex flex-col">
                    {/* Search */}
                    <div className="p-3 border-b border-white/10 dark:border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="搜索笔记..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white/50 dark:bg-gray-800/50 border border-white/40 dark:border-gray-700/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto scrollbar-hover p-2 space-y-1">
                        {loading ? (
                            <div className="text-center text-gray-400 py-4">加载中...</div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">暂无笔记</p>
                                <p className="text-xs mt-1">点击右上角 + 创建</p>
                            </div>
                        ) : (
                            filteredNotes.map(note => (
                                <div
                                    key={note.id}
                                    onClick={() => setSelectedId(note.id)}
                                    onDoubleClick={() => handleRenameStart(note)}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedId === note.id
                                        ? 'bg-white dark:bg-gray-700/80 shadow-sm border-blue-200 dark:border-blue-500/30'
                                        : 'hover:bg-white/30 dark:hover:bg-gray-700/30 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {/* Status dot */}
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${note.isPinned ? 'bg-amber-500' :
                                            note.isFloating ? 'bg-blue-500' : 'bg-gray-300'
                                            }`} />

                                        {/* Title */}
                                        {renamingId === note.id ? (
                                            <input
                                                type="text"
                                                value={renamingTitle}
                                                onChange={(e) => setRenamingTitle(e.target.value)}
                                                onBlur={handleRenameSubmit}
                                                onKeyDown={handleRenameKeyDown}
                                                autoFocus
                                                className="text-sm font-medium text-gray-700 flex-1 min-w-0 bg-white/80 border border-blue-400 rounded px-1 outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className={`text-sm font-medium flex-1 truncate ${selectedId === note.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                                                }`}>
                                                {note.title}
                                            </span>
                                        )}

                                        {/* Pin toggle button */}
                                        <button
                                            onClick={(e) => handleTogglePin(note.id, e)}
                                            className={`p-1 rounded transition-colors ${note.isPinned ? 'text-amber-500' : 'text-gray-400'
                                                }`}
                                            title={note.isPinned ? '取消置顶' : '置顶'}
                                        >
                                            <Pin size={16} className={note.isPinned ? 'fill-current' : ''} />
                                        </button>

                                        {/* Delete button (hover) */}
                                        <button
                                            onClick={(e) => handleDelete(note.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all transform hover:scale-110"
                                            title="删除笔记"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Subtitle */}
                                    <div className="text-[10px] text-gray-400 mt-1 pl-4">
                                        {new Date(note.updatedAt).toLocaleDateString()}
                                        {note.isFloating && ' · 悬浮中'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GlassPanel>
            </div>

            {/* Right Panel - Editor */}
            <div className="flex-1 flex flex-col gap-4 h-full overflow-y-auto scrollbar-hover pr-2">
                {selectedId ? (
                    <>
                        {/* Title Bar */}
                        <div className="flex items-center justify-between px-2">
                            <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                className="bg-transparent text-xl font-bold text-gray-800 dark:text-gray-100 outline-none flex-1"
                                placeholder="输入笔记标题..."
                            />
                            {/* Action buttons */}
                            <div className="flex items-center bg-gray-100/50 dark:bg-gray-800/50 p-0.5 rounded-lg h-8 gap-1">
                                <span className={`px-3 text-xs ${saveStatus === 'unsaved' ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {saveStatus === 'saving' ? '保存中...' : saveStatus === 'unsaved' ? '未保存' : '已保存'}
                                </span>
                                <button
                                    onClick={handleToggleDashboard}
                                    className={`h-full px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${notes.find(n => n.id === selectedId)?.showOnDashboard
                                        ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                                        }`}
                                    title={notes.find(n => n.id === selectedId)?.showOnDashboard ? '从主页移除' : '添加到主页'}
                                >
                                    <Layout size={14} />
                                    {notes.find(n => n.id === selectedId)?.showOnDashboard ? '已添加' : '主页'}
                                </button>
                                <button
                                    onClick={handleToggleFloat}
                                    className={`h-full px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${notes.find(n => n.id === selectedId)?.isFloating
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <ExternalLink size={14} />
                                    悬浮
                                </button>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <GlassPanel isDark={isDark} variant="panel" className="flex-1 flex flex-col overflow-hidden">
                            {/* Mode Toggle Buttons */}
                            <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 dark:border-gray-700/50 bg-white/20 dark:bg-gray-800/20">
                                <button
                                    onClick={() => setViewMode('edit')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'edit'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <Edit3 size={12} />
                                    编辑
                                </button>
                                <button
                                    onClick={() => setViewMode('dual')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'dual'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-white/50'
                                        }`}
                                >
                                    <Columns size={12} />
                                    双栏
                                </button>
                                <button
                                    onClick={() => setViewMode('split')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'split'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-white/50'
                                        }`}
                                >
                                    <List size={12} />
                                    拆分
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'preview'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-white/50'
                                        }`}
                                >
                                    <Eye size={12} />
                                    预览
                                </button>
                                <div className="flex-1" />
                                <span className="text-xs text-gray-400">
                                    {editContent.length} 字
                                </span>
                                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-2" />
                                <button
                                    onClick={() => {
                                        if (isFullScreen) {
                                            setIsFullScreen(false)
                                            if (fullScreenSource === 'board' && onExitFullScreen) {
                                                onExitFullScreen()
                                            }
                                            setFullScreenSource(null)
                                        } else {
                                            setIsFullScreen(true)
                                        }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-400 hover:text-blue-500 transition-colors"
                                    title={isFullScreen ? "退出全屏" : "全屏编辑"}
                                >
                                    {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                </button>
                            </div>

                            {/* Markdown Toolbar */}
                            {(viewMode === 'edit' || viewMode === 'dual') && (
                                <MarkdownToolbar
                                    textareaRef={textareaRef}
                                    content={editContent}
                                    onChange={handleChangeContent}
                                />
                            )}

                            {/* Content Area */}
                            <div
                                className="flex-1 overflow-hidden"
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                {viewMode === 'edit' ? (
                                    <textarea
                                        ref={textareaRef}
                                        value={editContent}
                                        onChange={e => handleChangeContent(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="w-full h-full p-6 bg-transparent outline-none resize-none font-mono text-gray-700 dark:text-gray-200 leading-relaxed scrollbar-hover scrollbar-stable"
                                        placeholder="在这里输入内容... 支持 Markdown 语法&#10;&#10;快捷键:&#10;Ctrl+B 粗体 | Ctrl+I 斜体 | Ctrl+K 链接 | Tab 缩进&#10;&#10;💡 拖拽图片到此处可直接插入"
                                    />
                                ) : viewMode === 'dual' ? (
                                    <div className="flex h-full">
                                        <div className="w-1/2 h-full border-r border-white/10">
                                            <textarea
                                                ref={textareaRef}
                                                value={editContent}
                                                onChange={e => handleChangeContent(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                className="w-full h-full p-4 bg-transparent outline-none resize-none font-mono text-gray-700 dark:text-gray-200 leading-relaxed text-sm scrollbar-hover scrollbar-stable"
                                                placeholder="在这里输入 Markdown..."
                                            />
                                        </div>
                                        <div className="w-1/2 h-full overflow-y-auto scrollbar-hover scrollbar-stable p-4 bg-white/30">
                                            <MarkdownRenderer content={editContent} />
                                        </div>
                                    </div>
                                ) : viewMode === 'split' ? (
                                    <div className="h-full overflow-y-auto scrollbar-hover scrollbar-stable p-4 space-y-1">
                                        {editContent.split('\n').map((line, i) => (
                                            line.trim() ? (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(line.trim())
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 text-sm font-mono transition-colors group flex items-center justify-between"
                                                >
                                                    <span className="truncate">{line}</span>
                                                    <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        点击复制
                                                    </span>
                                                </button>
                                            ) : (
                                                <div key={i} className="h-4" />
                                            )
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full overflow-y-auto scrollbar-hover scrollbar-stable p-6">
                                        <MarkdownRenderer content={editContent} />
                                    </div>
                                )}
                            </div>
                        </GlassPanel>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p>选择或创建一个笔记开始编辑</p>
                    </div>
                )}
            </div>

            <InputModal
                isDark={isDark}
                isOpen={isCreateModalOpen}
                title="新建笔记"
                placeholder="请输入笔记名称..."
                onConfirm={handleCreateConfirm}
                onCancel={() => setIsCreateModalOpen(false)}
                confirmText="创建"
            />

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
        </div>
    )
}

export default NotesView
