/**
 * 闪念胶囊视图 - 重构版
 * 风格: 干净、专注、"浮岛"美学
 * 基于用户提供的设计文档和参考实现
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Sparkles, ArrowRight, Calendar, Clock, AlertCircle, Tag,
    Loader2, X, Check, Bell
} from 'lucide-react'

// ===== 类型定义 =====
interface ParsedTask {
    title: string
    description?: string
    dueDate?: string
    dueTime?: string
    hasReminder: boolean
    reminderTime?: string
    priority: 'low' | 'medium' | 'high'
    tags: string[]
}

// ===== Smart Chip 组件 =====
interface ChipProps {
    icon: React.ReactNode
    label?: string | null
    color: 'blue' | 'orange' | 'red' | 'purple' | 'gray' | 'green'
    onClick?: () => void
}

const Chip: React.FC<ChipProps> = ({ icon, label, color, onClick }) => {
    if (!label) return null

    const colorStyles: Record<string, string> = {
        blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
        orange: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
        red: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
        purple: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
        gray: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200",
        green: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
    }

    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium 
                cursor-pointer transition-all duration-200 select-none
                animate-in zoom-in duration-200
                ${colorStyles[color] || colorStyles.gray}
            `}
        >
            {icon} {label}
        </div>
    )
}

// ===== 主组件 =====
export const CapsuleView: React.FC = () => {
    const [inputValue, setInputValue] = useState('')
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [parsedData, setParsedData] = useState<ParsedTask | null>(null)
    const [parseSource, setParseSource] = useState<'local' | 'cloud' | 'none'>('none')
    const [isSuccess, setIsSuccess] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // 自动聚焦输入框
    useEffect(() => {
        inputRef.current?.focus()

        // 监听来自主进程的事件
        const cleanupFocus = window.electronAPI?.onCapsuleFocusInput?.(() => {
            inputRef.current?.focus()
        })

        const cleanupReset = window.electronAPI?.onCapsuleReset?.(() => {
            setInputValue('')
            setParsedData(null)
            setIsSuccess(false)
        })

        return () => {
            cleanupFocus?.()
            cleanupReset?.()
        }
    }, [])

    // 防抖解析
    useEffect(() => {
        if (inputValue.length < 2) {
            setParsedData(null)
            setParseSource('none')
            return
        }

        const timer = setTimeout(async () => {
            setIsAnalyzing(true)
            try {
                const response = await window.electronAPI?.capsuleParse?.(inputValue)
                if (response?.result) {
                    setParsedData(response.result)
                    setParseSource(response.source as any)
                }
            } catch (error) {
                console.error('[CapsuleView] Parse error:', error)
            } finally {
                setIsAnalyzing(false)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [inputValue])

    // 更新窗口高度
    useEffect(() => {
        const height = parsedData ? 130 : 80
        window.electronAPI?.capsuleSetHeight?.(height)
    }, [parsedData])

    // 提交任务
    const handleSubmit = useCallback(async () => {
        if (!inputValue.trim() || !parsedData) return

        setIsSuccess(true)

        try {
            const result = await window.electronAPI?.capsuleCreateTask?.(parsedData)
            if (result?.success) {
                setTimeout(() => {
                    setInputValue('')
                    setParsedData(null)
                    setIsSuccess(false)
                    window.electronAPI?.capsuleHide?.()
                }, 800)
            }
        } catch (error) {
            console.error('[CapsuleView] Create task error:', error)
            setIsSuccess(false)
        }
    }, [inputValue, parsedData])

    // 键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        } else if (e.key === 'Escape') {
            window.electronAPI?.capsuleHide?.()
        }
    }

    // 格式化日期显示
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null
        const today = new Date()
        const date = new Date(dateStr)

        // Reset time parts to ensure correct day difference calculation
        today.setHours(0, 0, 0, 0)
        date.setHours(0, 0, 0, 0)

        const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (diff === 0) return '今天'
        if (diff === 1) return '明天'
        if (diff === 2) return '后天'

        const month = date.getMonth() + 1
        const day = date.getDate()
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        return `${month}月${day}日 ${weekDays[date.getDay()]}`
    }

    // 格式化优先级显示
    const formatPriority = (priority?: string) => {
        if (priority === 'high') return '高优先级'
        if (priority === 'low') return '低优先级'
        return null
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-start font-sans select-none">
            {/* 主容器 - 浮岛风格 */}
            <div className="w-full max-w-[680px] px-4">
                {/* 输入栏 */}
                <div className={`
                    relative bg-white/95 backdrop-blur-2xl
                    rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out
                    border border-white/50
                    ${parsedData ? 'rounded-b-none border-b-0' : ''}
                `}>
                    <div className="flex items-center p-3 gap-3">
                        {/* 左侧图标 - 渐变风格 */}
                        <div className={`
                            w-11 h-11 rounded-xl flex items-center justify-center shrink-0 
                            transition-all duration-500 ease-out
                            ${isSuccess
                                ? 'bg-green-500 shadow-lg shadow-green-500/30 scale-110 rotate-6'
                                : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20'
                            }
                        `}>
                            {isSuccess ? (
                                <Check className="text-white" size={24} strokeWidth={3} />
                            ) : isAnalyzing ? (
                                <Loader2 className="text-white animate-spin" size={22} />
                            ) : (
                                <Sparkles className="text-white" size={22} />
                            )}
                        </div>

                        {/* 输入框 */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="有什么想法？试试：“明天下午3点开会，提前10分钟提醒我”"
                            className="flex-1 bg-transparent border-none outline-none text-lg font-medium text-gray-800 placeholder-gray-400"
                            autoFocus
                        />

                        {/* 右侧操作区 */}
                        <div className="flex items-center gap-2">
                            {inputValue ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!parsedData}
                                    className={`
                                        p-2.5 rounded-xl transition-all duration-200
                                        ${parsedData
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:scale-105 active:scale-95'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    <ArrowRight size={18} />
                                </button>
                            ) : (
                                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
                                    <span className="font-mono">ESC</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 成功提示覆盖层 */}
                    {isSuccess && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/95 z-10 animate-in fade-in duration-200">
                            <span className="text-lg font-bold text-green-600 flex items-center gap-2">
                                <Check size={20} /> 已添加到任务列表
                            </span>
                        </div>
                    )}
                </div>

                {/* Smart Chips 卡片 */}
                <div className={`
                    bg-white/90 backdrop-blur-xl
                    border-x border-b border-white/50
                    rounded-b-2xl overflow-hidden transition-all duration-300 ease-out
                    ${parsedData ? 'max-h-16 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}
                `}>
                    <div className="px-4 py-2.5 flex items-center gap-2 text-sm border-t border-gray-100">
                        {parsedData && (
                            <>
                                {/* 日期 */}
                                <Chip
                                    icon={<Calendar size={13} />}
                                    label={formatDate(parsedData.dueDate)}
                                    color="blue"
                                />

                                {/* 时间 */}
                                <Chip
                                    icon={<Clock size={13} />}
                                    label={parsedData.dueTime}
                                    color="orange"
                                />

                                {/* 提醒 */}
                                {parsedData.hasReminder && (
                                    <Chip
                                        icon={<Bell size={13} />}
                                        label={parsedData.reminderTime || "已设提醒"}
                                        color="green"
                                    />
                                )}

                                {/* 优先级 */}
                                <Chip
                                    icon={<AlertCircle size={13} />}
                                    label={formatPriority(parsedData.priority)}
                                    color={parsedData.priority === 'high' ? 'red' : 'gray'}
                                />

                                {/* 标签 */}
                                {parsedData.tags?.map((tag, idx) => (
                                    <Chip
                                        key={idx}
                                        icon={<Tag size={13} />}
                                        label={tag}
                                        color="purple"
                                    />
                                ))}
                            </>
                        )}

                        {/* 解析来源指示 */}
                        {parseSource !== 'none' && (
                            <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
                                <span className={`
                                    w-1.5 h-1.5 rounded-full
                                    ${parseSource === 'cloud' ? 'bg-green-500' : 'bg-gray-400'}
                                `} />
                                <span>{parseSource === 'cloud' ? 'AI' : '本地'}</span>
                                <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-mono">↵</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CapsuleView
