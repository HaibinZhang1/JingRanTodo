/**
 * Smart Chip 组件
 * 显示解析结果的可编辑芯片
 */

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, Bell, AlertCircle, Hash, X, ChevronDown } from 'lucide-react'

export type ChipType = 'date' | 'time' | 'reminder' | 'priority' | 'tag'

interface SmartChipProps {
    type: ChipType
    value: string
    onEdit?: (newValue: string) => void
    onRemove?: () => void
}

// 芯片样式配置
const chipStyles: Record<ChipType, { bg: string; text: string; icon: React.ReactNode }> = {
    date: {
        bg: 'bg-blue-100 hover:bg-blue-200',
        text: 'text-blue-700',
        icon: <Calendar size={14} />
    },
    time: {
        bg: 'bg-orange-100 hover:bg-orange-200',
        text: 'text-orange-700',
        icon: <Clock size={14} />
    },
    reminder: {
        bg: 'bg-green-100 hover:bg-green-200 ring-2 ring-green-300',
        text: 'text-green-700',
        icon: <Bell size={14} />
    },
    priority: {
        bg: 'bg-red-100 hover:bg-red-200',
        text: 'text-red-700',
        icon: <AlertCircle size={14} />
    },
    tag: {
        bg: 'bg-purple-100 hover:bg-purple-200',
        text: 'text-purple-700',
        icon: <Hash size={14} />
    }
}

// 优先级选项
const priorityOptions = [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' }
]

// 快捷日期选项
const dateOptions = [
    { value: 'today', label: '今天' },
    { value: 'tomorrow', label: '明天' },
    { value: 'dayAfter', label: '后天' },
    { value: 'nextWeek', label: '下周一' }
]

// 计算快捷日期
function getDateValue(option: string): string {
    const today = new Date()
    switch (option) {
        case 'today':
            return formatDate(today)
        case 'tomorrow':
            return formatDate(addDays(today, 1))
        case 'dayAfter':
            return formatDate(addDays(today, 2))
        case 'nextWeek':
            // 下周一
            const dayOfWeek = today.getDay()
            const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
            return formatDate(addDays(today, daysUntilMonday))
        default:
            return option
    }
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// 格式化显示日期
function formatDisplayDate(dateStr: string): string {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const date = new Date(dateStr + 'T00:00:00')
    date.setHours(0, 0, 0, 0)

    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[date.getDay()]

    // 格式化日期部分 MM-DD
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const shortDate = `${month}-${day}`

    if (diffDays === 0) return `今天 ${weekDay}`
    if (diffDays === 1) return `明天 ${weekDay}`
    if (diffDays === 2) return `后天 ${weekDay}`
    if (diffDays > 0 && diffDays < 7) {
        return `${shortDate} ${weekDay}`
    }
    return `${dateStr} ${weekDay}`
}

// 格式化优先级
function formatPriority(priority: string): string {
    switch (priority) {
        case 'high': return '高优先级'
        case 'medium': return '中优先级'
        case 'low': return '低优先级'
        default: return priority
    }
}

export const SmartChip: React.FC<SmartChipProps> = ({
    type,
    value,
    onEdit,
    onRemove
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const popupRef = useRef<HTMLDivElement>(null)
    const chipRef = useRef<HTMLDivElement>(null)

    const style = chipStyles[type]

    // 点击外部关闭编辑
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
                chipRef.current && !chipRef.current.contains(e.target as Node)) {
                setIsEditing(false)
            }
        }

        if (isEditing) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isEditing])

    // 获取显示文本
    const getDisplayText = () => {
        switch (type) {
            case 'date':
                return formatDisplayDate(value)
            case 'time':
            case 'reminder':
                return value
            case 'priority':
                return formatPriority(value)
            case 'tag':
                return `#${value}`
            default:
                return value
        }
    }

    // 处理编辑确认
    const handleConfirm = (newValue: string) => {
        setEditValue(newValue)
        setIsEditing(false)
        onEdit?.(newValue)
    }

    // 渲染编辑弹窗
    const renderEditPopup = () => {
        if (!isEditing) return null

        return (
            <div
                ref={popupRef}
                className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50 min-w-[160px]"
            >
                {type === 'date' && (
                    <div className="space-y-1">
                        {dateOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleConfirm(getDateValue(opt.value))}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 rounded"
                            >
                                {opt.label}
                            </button>
                        ))}
                        <input
                            type="date"
                            value={editValue}
                            onChange={(e) => handleConfirm(e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm mt-1"
                        />
                    </div>
                )}

                {(type === 'time' || type === 'reminder') && (
                    <input
                        type="time"
                        value={editValue}
                        onChange={(e) => handleConfirm(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                        autoFocus
                    />
                )}

                {type === 'priority' && (
                    <div className="space-y-1">
                        {priorityOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleConfirm(opt.value)}
                                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 rounded ${editValue === opt.value ? 'bg-gray-100 font-medium' : ''
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {type === 'tag' && (
                    <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm(editValue)}
                        onBlur={() => handleConfirm(editValue)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                        placeholder="标签名称"
                        autoFocus
                    />
                )}
            </div>
        )
    }

    return (
        <div className="relative" ref={chipRef}>
            <div
                onClick={() => onEdit && setIsEditing(!isEditing)}
                className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
                    ${style.bg} ${style.text}
                    ${onEdit ? 'cursor-pointer' : ''}
                    transition-all duration-200
                `}
            >
                {style.icon}
                <span>{getDisplayText()}</span>
                {onEdit && <ChevronDown size={12} className="opacity-60" />}
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemove()
                        }}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {renderEditPopup()}
        </div>
    )
}

export default SmartChip
