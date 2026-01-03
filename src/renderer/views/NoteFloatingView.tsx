import React, { useEffect, useState, useCallback } from 'react'
import { Copy, Check, X, Edit3, Eye, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react'
import { Note } from '../store/notesSlice'
import MarkdownRenderer from '../components/MarkdownRenderer'

interface TextSettings {
    fontSize: number
    fontFamily: string
    opacity: number
}

const DEFAULT_TEXT_SETTINGS: TextSettings = {
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    opacity: 85
}

const NoteFloatingView: React.FC = () => {
    const [id, setId] = useState<string | null>(null)
    const [note, setNote] = useState<Note | null>(null)
    const [content, setContent] = useState('')
    const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('edit')
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
    const [textSettings, setTextSettings] = useState<TextSettings>(DEFAULT_TEXT_SETTINGS)
    const [isAltPressed, setIsAltPressed] = useState(false)
    const [showHeader, setShowHeader] = useState(true)

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
        setId(params.get('id'))
    }, [])

    const loadNote = useCallback(async () => {
        if (!id) return

        const notes: Note[] = await window.electronAPI.getAllNotes()
        const found = notes.find(n => n.id === id)

        if (found) {
            setNote(found)
            // Only update content if it's different and we are not currently editing (or it's a remote update)
            // Ideally, we should merge or just overwrite if it's a sync. 
            // Since this is a simple sync, we'll overwrite if the content on disk is different
            // But we need to be careful not to overwrite local unsaved changes if we can avoid it.
            // However, the issue is "dashboard updates -> floating window". 
            // Dashboard saves to disk. Floating window reads from disk.
            // We should update local state.
            // To avoid cursor jumping or conflict, we might check if content is different.
            setContent(prev => {
                if (prev !== found.content) return found.content
                return prev
            })

            setMode(found.mode || 'edit')
            setShowHeader(found.showHeader !== false)
            if ((found as any).textSettings) {
                setTextSettings((found as any).textSettings)
            }
        }
    }, [id])

    useEffect(() => {
        loadNote()
    }, [loadNote])

    // Listen for external updates
    useEffect(() => {
        const unsubscribe = window.electronAPI.onNoteDataChanged(() => {
            loadNote()
        })
        return unsubscribe
    }, [loadNote])

    // Alt key detection for drag mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') setIsAltPressed(true)
            if (e.key === 'Escape') handleClose()
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') setIsAltPressed(false)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        // Also clear on blur to prevent "stuck" Alt key
        window.addEventListener('blur', () => setIsAltPressed(false))

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('blur', () => setIsAltPressed(false))
        }
    }, [id])

    // 监听原生菜单事件
    useEffect(() => {
        const cleanup = window.electronAPI.onNoteMenuAction((data: any) => {
            switch (data.action) {
                case 'toggleMode':
                    toggleMode()
                    break
                case 'fontSizeUp':
                    adjustFontSize(1)
                    break
                case 'fontSizeDown':
                    adjustFontSize(-1)
                    break
                case 'setFont':
                    updateTextSettings({ fontFamily: data.value })
                    break
                case 'setOpacity':
                    updateTextSettings({ opacity: data.value })
                    break
                case 'toggleHeader':
                    toggleHeader()
                    break
            }
        })
        return cleanup
    }, [id, mode, textSettings, showHeader])

    // Ctrl + Mouse Wheel to adjust opacity
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -5 : 5
                const newOpacity = Math.max(30, Math.min(100, textSettings.opacity + delta))
                updateTextSettings({ opacity: newOpacity })
            }
        }

        window.addEventListener('wheel', handleWheel, { passive: false })
        return () => window.removeEventListener('wheel', handleWheel)
    }, [textSettings.opacity])

    // Header 拖拽移动窗口
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (!id) return
        e.preventDefault()

        const startMouseX = e.screenX
        const startMouseY = e.screenY

        window.electronAPI.noteWindowDragStart?.(id)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const offsetX = moveEvent.screenX - startMouseX
            const offsetY = moveEvent.screenY - startMouseY
            window.electronAPI.noteWindowMove?.(id, offsetX, offsetY)
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            window.electronAPI.noteWindowDragEnd?.(id)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    // Alt + Drag to move window (备选方案)
    const handleAltMouseDown = (e: React.MouseEvent) => {
        if (!id) return
        e.preventDefault()

        const startMouseX = e.screenX
        const startMouseY = e.screenY

        window.electronAPI.noteWindowDragStart?.(id)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const offsetX = moveEvent.screenX - startMouseX
            const offsetY = moveEvent.screenY - startMouseY
            window.electronAPI.noteWindowMove?.(id, offsetX, offsetY)
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            window.electronAPI.noteWindowDragEnd?.(id)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleClose = () => {
        if (id) window.electronAPI.noteWindowClose(id)
    }

    const handleChange = (val: string) => {
        setContent(val)
        if (id) {
            window.electronAPI.updateNote({ id, content: val })
        }
    }

    const toggleMode = () => {
        // 三种模式循环: edit -> split -> preview -> edit
        const modeOrder: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview']
        const currentIndex = modeOrder.indexOf(mode)
        const newMode = modeOrder[(currentIndex + 1) % modeOrder.length]
        setMode(newMode)
        if (id) {
            window.electronAPI.updateNote({ id, mode: newMode })
        }
    }

    // 直接切换到编辑模式（用于预览模式双击）
    const switchToEdit = () => {
        if (mode !== 'edit') {
            setMode('edit')
            if (id) {
                window.electronAPI.updateNote({ id, mode: 'edit' })
            }
        }
    }

    const toggleHeader = () => {
        const newShowHeader = !showHeader
        setShowHeader(newShowHeader)
        if (id) {
            window.electronAPI.updateNote({ id, showHeader: newShowHeader })
        }
    }

    const handleCopyLine = (text: string, index: number) => {
        if (!text.trim()) return
        navigator.clipboard.writeText(text.trim())
        setCopyFeedback(`${index}`)
        setTimeout(() => setCopyFeedback(null), 600)
    }

    const updateTextSettings = (updates: Partial<TextSettings>) => {
        const newSettings = { ...textSettings, ...updates }
        setTextSettings(newSettings)
        if (id) {
            window.electronAPI.updateNote({ id, textSettings: newSettings })
        }
    }

    const adjustFontSize = (delta: number) => {
        const newSize = Math.max(10, Math.min(24, textSettings.fontSize + delta))
        updateTextSettings({ fontSize: newSize })
    }

    // 显示原生右键菜单
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        if (!id) return
        window.electronAPI.noteShowContextMenu({
            id,
            mode,
            fontSize: textSettings.fontSize,
            opacity: textSettings.opacity,
            fontFamily: textSettings.fontFamily,
            showHeader
        })
    }

    if (!note) return <div className="h-screen w-screen flex items-center justify-center text-gray-400 text-xs">加载中...</div>

    const textStyle: React.CSSProperties = {
        fontSize: `${textSettings.fontSize}px`,
        fontFamily: textSettings.fontFamily,
    }

    // 获取模式图标
    const getModeIcon = () => {
        switch (mode) {
            case 'edit': return <Edit3 size={12} />
            case 'split': return <LayoutGrid size={12} />
            case 'preview': return <Eye size={12} />
        }
    }

    // 获取模式标签
    const getModeLabel = () => {
        switch (mode) {
            case 'edit': return '编辑'
            case 'split': return '拆分'
            case 'preview': return '预览'
        }
    }

    return (
        <div className="h-screen w-screen bg-transparent overflow-hidden">
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}
            >
                <div
                    className={`h-full w-full flex flex-col transition-all duration-200 ${isAltPressed && !showHeader ? 'cursor-move' : ''}`}
                    style={{
                        backgroundColor: `rgba(255, 255, 255, ${textSettings.opacity / 100})`,
                        backdropFilter: 'blur(12px)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
                    }}
                    onContextMenu={handleContextMenu}
                >
                    {/* 拖拽遮罩层 - 仅在 Alt 按下且无 Header 时出现 */}
                    {isAltPressed && !showHeader && (
                        <div
                            className="absolute inset-0 z-50 cursor-move"
                            onMouseDown={handleAltMouseDown}
                        />
                    )}

                    {/* Header - 可拖拽区域 */}
                    {showHeader ? (
                        <div
                            className="relative px-3 py-2 flex items-center justify-between gap-2 bg-white border-b border-gray-100 cursor-move select-none shrink-0"
                            onMouseDown={handleHeaderMouseDown}
                        >
                            {/* Left: Title */}
                            <h3 className="text-sm font-semibold text-gray-700 truncate flex-1 z-10">
                                {note.title || '无标题笔记'}
                            </h3>

                            {/* Center: Collapse Button */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleHeader() }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1 rounded hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors pointer-events-auto"
                                    title="收起标题栏"
                                >
                                    <ChevronUp size={14} />
                                </button>
                            </div>

                            {/* Right: Controls */}
                            <div className="flex items-center gap-1 z-10">
                                {/* 模式切换按钮 */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleMode() }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
                                    title={`切换模式 (当前: ${getModeLabel()})`}
                                >
                                    {getModeIcon()}
                                    <span className="text-[10px]">{getModeLabel()}</span>
                                </button>
                                {/* 关闭按钮 */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleClose() }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                    title="关闭 (Esc)"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Header Hidden - Shows trigger area on hover */
                        <>
                            {/* Invisible Trigger Area at Top */}
                            <div className="absolute top-0 left-0 right-0 h-4 z-40 group/trigger flex justify-center">
                                {/* Button appears on hover */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleHeader() }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="
                                        mt-0.5 px-2 py-0.5 
                                        bg-white/90 shadow-sm border border-gray-100 rounded-b-lg 
                                        opacity-0 group-hover/trigger:opacity-100 
                                        text-gray-400 hover:text-emerald-600 
                                        transition-all duration-200 transform -translate-y-full group-hover/trigger:translate-y-0
                                    "
                                    title="展开标题栏"
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </>
                    )}

                    {/* Content - 全高度显示 */}
                    <div className="flex-1 overflow-hidden min-h-0 no-drag">
                        {mode === 'edit' ? (
                            <textarea
                                value={content}
                                onChange={e => handleChange(e.target.value)}
                                className="w-full h-full p-3 bg-transparent outline-none resize-none text-gray-700 leading-relaxed scrollbar-hover"
                                style={textStyle}
                                spellCheck={false}
                                placeholder="输入笔记..."
                            />
                        ) : mode === 'split' ? (
                            <div className="h-full overflow-y-auto p-2 scrollbar-hover scrollbar-stable">
                                {content.split('\n').map((line, i) => (
                                    line.trim() ? (
                                        <button
                                            key={i}
                                            onClick={() => handleCopyLine(line, i)}
                                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-blue-50/80 text-gray-700 flex items-center justify-between group/item transition-colors"
                                            style={textStyle}
                                        >
                                            <span className="truncate leading-snug">{line}</span>
                                            {copyFeedback === `${i}` ? (
                                                <Check size={12} className="text-green-500 shrink-0 ml-2" />
                                            ) : (
                                                <Copy size={10} className="opacity-0 group-hover/item:opacity-100 text-gray-300 shrink-0 ml-2" />
                                            )}
                                        </button>
                                    ) : (
                                        <div key={i} className="h-3" />
                                    )
                                ))}
                            </div>
                        ) : (
                            /* Preview Mode - Markdown 渲染，双击切换到编辑模式 */
                            <div
                                className="h-full overflow-y-auto p-3 scrollbar-hover scrollbar-stable cursor-text"
                                onDoubleClick={switchToEdit}
                                title="双击进入编辑模式"
                            >
                                <MarkdownRenderer content={content} style={textStyle} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NoteFloatingView
