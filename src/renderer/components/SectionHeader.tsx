import React, { useState } from 'react'

interface SectionHeaderProps {
    title: string
    icon: React.ReactNode
    count?: number  // 可选，不传则不显示计数徽章
    countColor?: string
    isEditable?: boolean
    onTitleChange?: (newTitle: string) => void
}

/**
 * 区域标题组件
 * 显示图标、标题和任务计数
 * 支持双击编辑标题（当 isEditable 为 true 时）
 */
export const SectionHeader: React.FC<SectionHeaderProps & { className?: string }> = ({
    title,
    icon,
    count,
    countColor,
    isEditable = false,
    onTitleChange,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(title)

    const handleDoubleClick = () => {
        if (isEditable && onTitleChange) {
            setEditValue(title)
            setIsEditing(true)
        }
    }

    const handleSubmit = () => {
        if (editValue.trim() && editValue !== title) {
            onTitleChange?.(editValue.trim())
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit()
        } else if (e.key === 'Escape') {
            setEditValue(title)
            setIsEditing(false)
        }
    }

    return (
        <div className={`flex items-center gap-2 px-1 ${className}`}>
            {icon}
            {isEditing ? (
                <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSubmit}
                    onKeyDown={handleKeyDown}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="font-bold text-gray-800 text-sm bg-white/50 border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                />
            ) : (
                <h3
                    className={`font-bold text-gray-800 text-sm ${isEditable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                    onDoubleClick={handleDoubleClick}
                    title={isEditable ? '双击编辑标题' : undefined}
                >
                    {title}
                </h3>
            )}
            {count !== undefined && (
                <span className={`${countColor} text-white text-xs px-2 py-0.5 rounded-full font-medium ml-auto`}>
                    {count}
                </span>
            )}
        </div>
    )
}

export default SectionHeader
