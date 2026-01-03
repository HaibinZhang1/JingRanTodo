import React, { useState, useEffect } from 'react'
import { GlassPanel } from './GlassPanel'
import { X } from 'lucide-react'

interface InputModalProps {
    isOpen: boolean
    title: string
    defaultValue?: string
    placeholder?: string
    onConfirm: (value: string) => void
    onCancel: () => void
    confirmText?: string
    cancelText?: string
    isDark?: boolean
}

export const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    title,
    defaultValue = '',
    placeholder = '',
    onConfirm,
    onCancel,
    confirmText = '确定',
    cancelText = '取消',
    isDark = false
}) => {
    const [value, setValue] = useState(defaultValue)

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue)
        }
    }, [isOpen, defaultValue])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (value.trim()) {
            onConfirm(value.trim())
            onCancel() // Close modal after confirm
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
            <GlassPanel isDark={isDark} variant="modal" className="w-[400px] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10 dark:border-white/5">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <input
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-gray-700 dark:text-gray-200 dark:placeholder-gray-500 mb-6"
                        autoFocus
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="submit"
                            disabled={!value.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
            </GlassPanel>
        </div>
    )
}
