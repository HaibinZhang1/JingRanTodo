import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Edit3 } from 'lucide-react'

const NoteInputView: React.FC = () => {
    const [title, setTitle] = useState('新建闪念笔记')
    const inputRef = useRef<HTMLInputElement>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        // 自动聚焦并选中全部文本
        if (inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.electronAPI?.windowClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!title.trim() || isSubmitting) return

        setIsSubmitting(true)

        try {
            // 1. 创建笔记
            const newNote = await window.electronAPI.createNote({
                title: title.trim(),
                content: '',
                isFloating: true
            })

            // 2. 打开笔记浮窗
            await window.electronAPI.noteWindowCreate({
                id: newNote.id,
                width: 320,
                height: 320
            })

            // 3. 关闭输入窗口
            window.electronAPI.windowClose()
        } catch (err) {
            console.error('Failed to create note:', err)
            setIsSubmitting(false)
        }
    }

    return (
        <div className="h-screen w-screen bg-transparent overflow-hidden flex items-center justify-center font-sans">
            <div className="w-[400px] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Edit3 size={16} />
                    </div>
                    <span className="font-semibold text-gray-700">新建闪念笔记</span>
                    <button
                        onClick={() => window.electronAPI.windowClose()}
                        className="ml-auto p-1 rounded-md hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-gray-700 text-lg placeholder-gray-300"
                            placeholder="输入笔记标题..."
                        />
                    </div>

                    <div className="mt-5 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => window.electronAPI.windowClose()}
                            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !title.trim()}
                            className={`
                                flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white shadow-lg shadow-emerald-500/20
                                transition-all duration-200
                                ${isSubmitting || !title.trim()
                                    ? 'bg-emerald-300 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]'}
                            `}
                        >
                            {isSubmitting ? '创建中...' : (
                                <>
                                    <Check size={16} />
                                    确认创建
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default NoteInputView
