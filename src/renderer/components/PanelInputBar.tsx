import React, { useRef } from 'react'
import { Plus, Edit3 } from 'lucide-react'

interface PanelInputBarProps {
    placeholder: string
    inputValue: string
    setInputValue: (val: string) => void
    onAdd: () => void
    onDetailClick?: (prefillTitle?: string) => void
    compact?: boolean
    isDark?: boolean
}

/**
 * 隐形输入栏组件
 * - 默认透明，悬停时显示背景和蓝色边框
 * - 回车或点击+按钮提交任务
 * - 点击编辑按钮进入编辑界面带预填标题
 */
export const PanelInputBar: React.FC<PanelInputBarProps> = ({
    placeholder,
    inputValue,
    setInputValue,
    onAdd,
    onDetailClick,
    compact = false,
    isDark = false,
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            onAdd()
        }
    }

    const handleBlur = () => {
        if (inputValue.trim()) {
            onAdd()
        }
    }

    // + 按钮直接添加任务
    const handleAddButtonClick = () => {
        if (inputValue.trim()) {
            onAdd()
        }
    }

    // 编辑按钮打开编辑界面
    const handleEditButtonClick = () => {
        if (onDetailClick) {
            onDetailClick(inputValue.trim())
        }
    }

    return (
        <div className={`
            relative flex items-center gap-2
            transition-all duration-300 ease-in-out
            border-b border-transparent 
            bg-transparent 
            hover:bg-blue-50/50 dark:hover:bg-blue-900/40 hover:border-blue-400
            group/input
            ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5 gap-3'}
        `}>
            {/* 视觉引导：静态的 + 号 */}
            <div className="text-gray-400 dark:text-gray-500 group-hover/input:text-blue-500 dark:group-hover/input:text-blue-400 transition-colors duration-300">
                <Plus size={compact ? 14 : 18} />
            </div>

            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`
                    flex-1 bg-transparent border-none outline-none
                    text-gray-700 dark:text-gray-200 placeholder-gray-400/70 dark:placeholder-gray-500/70 group-hover/input:placeholder-blue-400 dark:group-hover/input:placeholder-blue-400 
                    transition-all duration-300 cursor-pointer group-hover/input:cursor-text
                    ${compact ? 'text-xs' : 'text-sm'}
                `}
            />

            {/* 悬停时显示两个按钮：添加 和 编辑 */}
            <div className="flex items-center gap-1 opacity-0 group-hover/input:opacity-100 transition-all duration-300 transform translate-x-2 group-hover/input:translate-x-0">
                {/* + 按钮：直接添加任务 */}
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddButtonClick}
                    className={`bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm ${compact ? 'p-1' : 'p-1.5'}`}
                    title="直接添加任务"
                >
                    <Plus size={compact ? 12 : 16} />
                </button>
                {/* 编辑按钮：打开编辑界面 */}
                {onDetailClick && (
                    <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleEditButtonClick}
                        className={`bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors shadow-sm ${compact ? 'p-1' : 'p-1.5'}`}
                        title="进入编辑界面"
                    >
                        <Edit3 size={compact ? 12 : 16} />
                    </button>
                )}
            </div>
        </div>
    )
}

export default PanelInputBar



