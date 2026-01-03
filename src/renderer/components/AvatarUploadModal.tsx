import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Trash2 } from 'lucide-react'
import GlassPanel from './GlassPanel'
import iconPng from '/icon.png?url'

interface AvatarUploadModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (avatarPath: string) => void
    currentAvatar?: string | null
    opacity?: number
    isDark?: boolean
}

const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentAvatar,
    opacity = 60,
    isDark = false
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [selectedHistoryUrl, setSelectedHistoryUrl] = useState<string | null>(null)
    const [history, setHistory] = useState<{ url: string; name: string }[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPreviewUrl(currentAvatar || null)
            setSelectedFile(null)
            setSelectedHistoryUrl(null)
            loadHistory()
        }
    }, [isOpen, currentAvatar])



    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleFileSelect = async () => {
        try {
            const result = await (window.electronAPI as any)?.selectAvatarFile?.()
            if (result && result.path) {
                // Auto save on upload
                const savedPath = await (window.electronAPI as any)?.saveAvatar?.(result.path)
                if (savedPath) {
                    onSave(savedPath)
                    await loadHistory()
                    // Don't close modal as requested
                }
            }
        } catch (error) {
            console.error('Failed to select avatar file:', error)
        }
    }

    const loadHistory = async () => {
        try {
            const list = await (window.electronAPI as any)?.getAvatarList?.() || []
            // Ensure compat if API returns old format temporarily or during update
            const formattedList = list.map((item: string | { url: string; name: string }) =>
                typeof item === 'string' ? { url: item, name: '' } : item
            )
            // Prepend Default Item
            setHistory([{ name: 'default', url: '' }, ...formattedList])
        } catch (e) {
            console.error('Failed to load avatar history:', e)
        }
    }

    const handleHistorySelect = async (item: { url: string; name: string }) => {
        try {
            if (item.name === 'default') {
                // Restore Default
                await (window.electronAPI as any)?.removeAvatar?.()
                onSave('')
            } else {
                // Select History Item
                await (window.electronAPI as any)?.selectAvatar?.(item.url)
                onSave(item.url)
            }
            // onClose() - Removed auto-close
        } catch (error) {
            console.error('Failed to select history item:', error)
        }
    }

    const handleDeleteHistoryItem = async (e: React.MouseEvent, filename: string) => {
        e.stopPropagation()
        if (filename === 'default') return // Prevent deleting default

        try {
            await (window.electronAPI as any)?.deleteAvatarHistoryItem?.(filename)
            loadHistory()
        } catch (error) {
            console.error('Failed to delete history item:', error)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in supports-[backdrop-filter]:bg-black/20"
            onClick={onClose}
        >
            <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                <GlassPanel
                    variant="modal"
                    opacity={opacity}
                    isDark={isDark}
                    className="w-[380px] p-0 overflow-hidden shadow-2xl rounded-[32px] border-white/60 dark:border-gray-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-0">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
                            修改头像
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Avatar Preview */}
                    <div className="flex flex-col items-center p-8 pb-8">
                        <div
                            className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-tr from-blue-500 to-purple-500 shadow-xl cursor-pointer group mb-8"
                            onClick={handleFileSelect}
                        >
                            {/* Current active avatar (preview) */}
                            {currentAvatar ? (
                                <img
                                    src={currentAvatar}
                                    alt="Avatar preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-transparent flex items-center justify-center">
                                    <img src={iconPng} alt="Default" className="w-full h-full object-cover" />
                                </div>
                            )}

                            {/* Hover overlay - Click to Upload */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera size={32} className="text-white" />
                            </div>
                        </div>

                        {/* History Grid */}
                        <div className="w-full">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 ml-1 uppercase tracking-wider">历史头像</h4>
                            <div className="grid grid-cols-5 gap-3">
                                {history.map((item, index) => (
                                    <div key={index} className="relative group">
                                        <button
                                            onClick={() => handleHistorySelect(item)}
                                            className={`
                                                w-full aspect-square rounded-xl overflow-hidden border-2 transition-all relative
                                                ${(item.name === 'default' && !currentAvatar) || (currentAvatar === item.url && item.name !== 'default')
                                                    ? 'border-blue-500 ring-2 ring-blue-500/20 scale-105'
                                                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                                }
                                                ${item.name === 'default' ? 'bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center' : ''}
                                            `}
                                        >
                                            {item.name === 'default' ? (
                                                <img src={iconPng} alt="Default" className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={item.url} className="w-full h-full object-cover" alt={`History ${index}`} />
                                            )}
                                        </button>

                                        {/* Delete button (Not for default) */}
                                        {item.name !== 'default' && (
                                            <button
                                                onClick={(e) => handleDeleteHistoryItem(e, item.name)}
                                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-600 backdrop-blur-sm"
                                                title="删除此记录"
                                            >
                                                <Trash2 size={10} strokeWidth={2.5} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                </GlassPanel>
            </div>
        </div>
    )
}

export default AvatarUploadModal
