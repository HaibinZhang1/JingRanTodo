import React, { useState, useRef, useEffect } from 'react'
import { FileText, Trash2, ExternalLink, Eye, Edit3, Maximize2 } from 'lucide-react'
import { GlassPanel } from './GlassPanel'
import { SectionHeader } from './SectionHeader'
import MarkdownRenderer from './MarkdownRenderer'
import type { Note } from '../store/notesSlice'

interface NotePanelProps {
    note: Note
    onRemove: () => void
    onOpenFloatWindow: () => void
    onCloseFloatWindow: () => void
    isFloatWindowOpen: boolean
    opacity?: number
    dragListeners?: any
    isDragging?: boolean
    onContentChange: (noteId: string, content: string) => void
    onTitleChange?: (noteId: string, newTitle: string) => void
    onOpenFullScreen?: () => void
    isDark?: boolean
}

export const NotePanel: React.FC<NotePanelProps> = ({
    note,
    onRemove,
    onOpenFloatWindow,
    onCloseFloatWindow,
    isFloatWindowOpen,
    opacity = 50,
    dragListeners,
    isDragging = false,
    onContentChange,
    onTitleChange,
    onOpenFullScreen,
    isDark = false
}) => {
    const [mode, setMode] = useState<'edit' | 'preview'>('edit')
    const [content, setContent] = useState(note.content)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 同步外部内容变化
    useEffect(() => {
        setContent(note.content)
    }, [note.content])

    const handleContentChange = (newContent: string) => {
        setContent(newContent)
        setSaveStatus('unsaved')

        // 防抖保存
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = setTimeout(() => {
            setSaveStatus('saving')
            onContentChange(note.id, newContent)
            setSaveStatus('saved')
        }, 200)
    }

    const toggleMode = () => {
        // 切换前先保存
        if (mode === 'edit' && saveStatus === 'unsaved') {
            onContentChange(note.id, content)
            setSaveStatus('saved')
        }
        setMode(mode === 'edit' ? 'preview' : 'edit')
    }

    // 图片拖拽处理
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
        if (mode !== 'edit') {
            // 不在编辑模式时自动切换到编辑模式
            setMode('edit')
        }

        for (const file of imageFiles) {
            try {
                const filePath = (file as any).path
                if (!filePath) continue

                const relativePath = await (window as any).electronAPI?.saveNoteImage?.(filePath)
                if (!relativePath) continue

                const imageMarkdown = `![${file.name}](${relativePath})`
                const newContent = content + imageMarkdown
                handleContentChange(newContent)
            } catch (error) {
                console.error('Failed to save image:', error)
            }
        }
    }

    return (
        <div className={`flex flex-col min-h-0 flex-1 min-w-[310px] transition-all duration-300 group/panel`}>
            <div className="flex-1 min-h-0 relative">
                <GlassPanel
                    isDark={isDark}
                    opacity={opacity}
                    className={`h-full rounded-xl flex flex-col overflow-hidden ${isDragging ? 'ring-2 ring-emerald-400 ring-opacity-50' : ''}`}
                >
                    {/* Header - 可拖拽区域 */}
                    <div
                        className={`flex items-center justify-between p-3 pb-2 shrink-0 border-b border-white/20 dark:border-white/10 drag-handle cursor-move select-none ${isDragging ? 'bg-emerald-50/50 dark:bg-emerald-900/30' : ''}`}
                        {...(dragListeners || {})}
                    >
                        <SectionHeader
                            title={note.title}
                            icon={<div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400"><FileText size={16} /></div>}
                            className="mb-0"
                            isEditable={!!onTitleChange}
                            onTitleChange={onTitleChange ? (newTitle) => onTitleChange(note.id, newTitle) : undefined}
                        />
                        <div className="flex items-center gap-1 opacity-0 group-hover/panel:opacity-100 transition-opacity">
                            {/* 保存状态 */}
                            {mode === 'edit' && (
                                <span className={`px-2 text-xs ${saveStatus === 'unsaved' ? 'text-amber-500' : 'text-gray-400'}`}>
                                    {saveStatus === 'saving' ? '保存中...' : saveStatus === 'unsaved' ? '未保存' : '已保存'}
                                </span>
                            )}

                            {/* 编辑/预览切换 - 图标显示当前模式 */}
                            <button
                                onClick={toggleMode}
                                className={`p-1.5 rounded-lg transition-all ${mode === 'edit' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}
                                title={mode === 'edit' ? '当前: 编辑模式，点击切换到预览' : '当前: 预览模式，点击切换到编辑'}
                            >
                                {mode === 'edit' ? <Edit3 size={15} /> : <Eye size={15} />}
                            </button>

                            {/* 全屏按钮 */}
                            {onOpenFullScreen && (
                                <button
                                    onClick={onOpenFullScreen}
                                    className="p-1.5 rounded-lg transition-all text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-gray-600/50"
                                    title="全屏编辑"
                                >
                                    <Maximize2 size={15} />
                                </button>
                            )}

                            {/* 悬浮窗口按钮 */}
                            <button
                                onClick={isFloatWindowOpen ? onCloseFloatWindow : onOpenFloatWindow}
                                className={`p-1.5 rounded-lg transition-all relative ${isFloatWindowOpen ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-400' : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}
                                title={isFloatWindowOpen ? "关闭浮窗" : "开启浮窗"}
                            >
                                <ExternalLink size={15} />
                            </button>

                            {/* 从主页移除按钮 */}
                            <button
                                onClick={onRemove}
                                className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600/50 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                title="从主页移除"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div
                        className="flex-1 overflow-hidden min-h-[60px]"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {mode === 'edit' ? (
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => handleContentChange(e.target.value)}
                                className="w-full h-full p-3 bg-transparent outline-none resize-none font-mono text-sm text-gray-700 dark:text-gray-200 leading-relaxed scrollbar-hover"
                                placeholder="输入笔记内容..."
                                spellCheck={false}
                            />
                        ) : (
                            <div className="h-full overflow-y-auto p-3 scrollbar-hover scrollbar-stable">
                                {content.trim() ? (
                                    <MarkdownRenderer content={content} />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                        <div className="text-center">
                                            <FileText size={24} className="mx-auto mb-2 opacity-50" />
                                            <p>空笔记</p>
                                            <button
                                                onClick={() => setMode('edit')}
                                                className="mt-2 text-xs text-emerald-500 hover:underline"
                                            >
                                                点击编辑
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </GlassPanel>
            </div>
        </div>
    )
}

export default NotePanel
