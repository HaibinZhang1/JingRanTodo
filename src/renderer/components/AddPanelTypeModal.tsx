import React, { useState } from 'react'
import { X, PlusSquare, FileText, Check, Plus } from 'lucide-react'
import { GlassPanel } from './GlassPanel'
import type { Note } from '../store/notesSlice'

interface AddPanelTypeModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectTaskPanel: () => void
    onSelectNotePanel: (noteId: string) => void
    onCreateNote?: (title: string) => Promise<string | null>  // 返回新建笔记的 ID
    notes: Note[]  // 可选的笔记列表
    existingNotePanelIds: string[]  // 已经在主页显示的笔记ID
    isDark?: boolean
}

type Step = 'select-type' | 'select-note' | 'create-note'

export const AddPanelTypeModal: React.FC<AddPanelTypeModalProps> = ({
    isOpen,
    onClose,
    onSelectTaskPanel,
    onSelectNotePanel,
    onCreateNote,
    notes,
    existingNotePanelIds,
    isDark = false
}) => {
    const [step, setStep] = useState<Step>('select-type')
    const [searchQuery, setSearchQuery] = useState('')
    const [newNoteTitle, setNewNoteTitle] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    if (!isOpen) return null

    // 过滤已添加到主页的笔记
    const availableNotes = notes.filter(n => !existingNotePanelIds.includes(n.id))
    const filteredNotes = availableNotes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleClose = () => {
        setStep('select-type')
        setSearchQuery('')
        setNewNoteTitle('')
        onClose()
    }

    const handleSelectTaskPanel = () => {
        handleClose()
        onSelectTaskPanel()
    }

    const handleSelectNote = (noteId: string) => {
        handleClose()
        onSelectNotePanel(noteId)
    }

    const handleBack = () => {
        if (step === 'create-note') {
            setStep('select-note')
            setNewNoteTitle('')
        } else {
            setStep('select-type')
            setSearchQuery('')
        }
    }

    const handleCreateNote = async () => {
        if (!newNoteTitle.trim() || !onCreateNote || isCreating) return

        setIsCreating(true)
        try {
            const noteId = await onCreateNote(newNoteTitle.trim())
            if (noteId) {
                // 笔记已经在 onCreateNote 中设置了 showOnDashboard: true
                // 不需要再调用 onSelectNotePanel（那会触发 toggle 把它设回 false）
                handleClose()
            }
        } catch (error) {
            console.error('Failed to create note:', error)
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <GlassPanel isDark={isDark} variant="modal" className="w-96 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        {step === 'select-type' ? '选择卡片类型' : step === 'select-note' ? '选择笔记' : '新建笔记'}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {step === 'select-type' ? (
                    /* Step 1: Select Panel Type */
                    <div className="space-y-3">
                        <button
                            onClick={handleSelectTaskPanel}
                            className="w-full p-4 flex items-center gap-4 bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-600/50 border border-white/40 dark:border-gray-600/30 rounded-xl transition-all group"
                        >
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                <PlusSquare size={24} />
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-gray-800 dark:text-gray-200">任务卡片</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">创建新的任务面板，用于管理任务</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setStep('select-note')}
                            className="w-full p-4 flex items-center gap-4 bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-600/50 border border-white/40 dark:border-gray-600/30 rounded-xl transition-all group"
                        >
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                <FileText size={24} />
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-gray-800 dark:text-gray-200">笔记卡片</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">将笔记添加到主页，快速查看和编辑</div>
                            </div>
                        </button>
                    </div>
                ) : step === 'select-note' ? (
                    /* Step 2: Select Note */
                    <div className="space-y-3">
                        {/* Back Button */}
                        <button
                            onClick={handleBack}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
                        >
                            ← 返回
                        </button>

                        {/* Search */}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索笔记..."
                            className="w-full px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-white/40 dark:border-gray-600/30 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400 text-sm dark:text-gray-200 dark:placeholder-gray-400"
                            autoFocus
                        />

                        {/* Create New Note Button */}
                        {onCreateNote && (
                            <button
                                onClick={() => setStep('create-note')}
                                className="w-full p-3 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50 rounded-xl transition-all text-left group"
                            >
                                <div className="p-1.5 bg-emerald-500 rounded-lg text-white">
                                    <Plus size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-emerald-700 dark:text-emerald-400">新建笔记</div>
                                    <div className="text-xs text-emerald-500 dark:text-emerald-500/80">创建新笔记并添加到主页</div>
                                </div>
                            </button>
                        )}

                        {/* Notes List */}
                        <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-hover">
                            {filteredNotes.length === 0 ? (
                                <div className="text-center text-gray-400 py-6">
                                    {availableNotes.length === 0 && notes.length > 0 ? (
                                        <>
                                            <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">所有笔记已添加到主页</p>
                                        </>
                                    ) : notes.length === 0 ? (
                                        <>
                                            <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">暂无笔记</p>
                                            <p className="text-xs mt-1">点击上方"新建笔记"创建</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm">未找到匹配的笔记</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                filteredNotes.map(note => (
                                    <button
                                        key={note.id}
                                        onClick={() => handleSelectNote(note.id)}
                                        className="w-full p-3 flex items-center gap-3 bg-white/30 dark:bg-gray-700/30 hover:bg-white/60 dark:hover:bg-gray-700/60 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-700/50 rounded-xl transition-all text-left group"
                                    >
                                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-500">
                                            <FileText size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{note.title}</div>
                                            <div className="text-xs text-gray-400 truncate">
                                                {note.content.slice(0, 50) || '空笔记'}
                                            </div>
                                        </div>
                                        <Check size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    /* Step 3: Create Note */
                    <div className="space-y-3">
                        {/* Back Button */}
                        <button
                            onClick={handleBack}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
                        >
                            ← 返回
                        </button>

                        {/* Note Title Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">笔记标题</label>
                            <input
                                type="text"
                                value={newNoteTitle}
                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
                                placeholder="输入笔记标题..."
                                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-white/40 dark:border-gray-600/30 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400 dark:text-gray-200"
                                autoFocus
                            />
                        </div>

                        {/* Create Button */}
                        <button
                            onClick={handleCreateNote}
                            disabled={!newNoteTitle.trim() || isCreating}
                            className="w-full py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <Plus size={18} />
                                    创建并添加到主页
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-white/20 dark:border-gray-700/30">
                    <button
                        onClick={handleClose}
                        className="w-full py-2 bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-white/70 dark:hover:bg-gray-600/50 transition-colors"
                    >
                        取消
                    </button>
                </div>
            </GlassPanel>
        </div>
    )
}

export default AddPanelTypeModal
