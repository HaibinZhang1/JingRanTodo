import React, { useEffect } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import GlassPanel from './GlassPanel'

interface ConfirmModalProps {
    isOpen: boolean
    title: string
    content: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    type?: 'danger' | 'warning' | 'info'
    isDark?: boolean
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    content,
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
    onCancel,
    type = 'danger',
    isDark = false
}) => {
    // 键盘快捷键: ESC 取消, Enter 确定
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onCancel()
            } else if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                onConfirm()
                onCancel()
            }
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [isOpen, onConfirm, onCancel])

    if (!isOpen) return null

    // 根据类型获取图标和颜色配置
    const getConfig = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: <AlertTriangle size={36} strokeWidth={2.5} />,
                    iconBg: 'bg-red-50',
                    iconColor: 'text-red-500',
                    ringColor: 'ring-red-50/50',
                    gradient: 'from-red-500 to-rose-600',
                    shadow: 'shadow-red-500/30'
                }
            case 'warning':
                return {
                    icon: <AlertTriangle size={36} strokeWidth={2.5} />,
                    iconBg: 'bg-orange-50',
                    iconColor: 'text-orange-500',
                    ringColor: 'ring-orange-50/50',
                    gradient: 'from-orange-500 to-amber-600',
                    shadow: 'shadow-orange-500/30'
                }
            case 'info':
            default:
                return {
                    icon: <Info size={36} strokeWidth={2.5} />,
                    iconBg: 'bg-blue-50',
                    iconColor: 'text-blue-500',
                    ringColor: 'ring-blue-50/50',
                    gradient: 'from-blue-500 to-indigo-600',
                    shadow: 'shadow-blue-500/30'
                }
        }
    }

    const config = getConfig()

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in supports-[backdrop-filter]:bg-black/20"
            onClick={onCancel}
        >
            <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                <GlassPanel isDark={isDark} variant="modal" className="w-[420px] p-0 overflow-hidden shadow-2xl rounded-[32px] border-white/60 dark:border-white/10">
                    <div className="flex flex-col items-center p-8 pt-10 text-center">
                        {/* 动态图标气泡 */}
                        <div className={`
                             w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl transition-transform
                             ${config.iconBg} ${config.iconColor} ring-8 ${config.ringColor}
                        `}>
                            {config.icon}
                        </div>

                        {/* 标题和内容 */}
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 tracking-tight font-display">
                            {title}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[15px] mb-2 px-4">
                            {content}
                        </p>
                    </div>

                    {/* 底部按钮组 */}
                    <div className="grid grid-cols-2 gap-3 p-6 pt-0">
                        <button
                            onClick={onCancel}
                            className="py-3 rounded-2xl font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors border border-gray-200/60 dark:border-gray-600/30 active:scale-95 duration-200"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm()
                                onCancel()
                            }}
                            className={`
                                py-3 rounded-2xl font-bold text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200
                                bg-gradient-to-r ${config.gradient} ${config.shadow} hover:shadow-xl
                            `}
                        >
                            {confirmText}
                        </button>
                    </div>
                </GlassPanel>
            </div>
        </div>
    )
}

export default ConfirmModal
