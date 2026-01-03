import React from 'react'
import { useAppSelector } from '../hooks/useRedux'
import type { RootState } from '../store'

// 语义化变体类型
export type GlassPanelVariant = 'panel' | 'modal' | 'card'

interface GlassPanelProps {
    children: React.ReactNode
    className?: string
    opacity?: number           // 自定义透明度，优先级最高
    variant?: GlassPanelVariant // 语义化变体
    interactive?: boolean
    style?: React.CSSProperties
    onClick?: () => void
    isDark?: boolean
    'data-testid'?: string      // E2E 测试标识符
}

/**
 * 通用毛玻璃容器组件
 * 使用 backdrop-blur 实现 Glassmorphism 效果
 * 支持暗色模式适配和语义化透明度变体
 * 
 * 透明度优先级：
 * 1. opacity prop（如果传入）
 * 2. 根据 variant 从 store 获取对应透明度
 * 3. 默认值 60
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
    children,
    className = "",
    opacity,
    variant,
    interactive = false,
    style,
    onClick,
    isDark = false,
    'data-testid': dataTestId
}) => {
    const themeConfig = useAppSelector((state: RootState) => state.settings.themeConfig)

    // 计算最终透明度：优先使用 opacity prop，其次根据 variant 获取，最后使用默认值
    const getOpacity = (): number => {
        if (opacity !== undefined) return opacity

        if (variant) {
            switch (variant) {
                case 'panel':
                    return themeConfig.opacity.panel
                case 'modal':
                    return themeConfig.opacity.modal
                case 'card':
                    return 30 // 卡片使用固定透明度
                default:
                    return 60
            }
        }

        return 60
    }

    const finalOpacity = getOpacity()

    // 根据 isDark 计算背景色和边框色
    const bgColor = isDark
        ? `rgba(17, 24, 39, ${finalOpacity / 100})` // gray-900
        : `rgba(255, 255, 255, ${finalOpacity / 100})`

    const borderClass = isDark ? 'border-gray-700/50' : 'border-white/40'
    const hoverClass = isDark
        ? 'hover:bg-gray-800/70'
        : 'hover:bg-white/70'

    return (
        <div
            className={`
                relative backdrop-blur-xl border shadow-xl rounded-2xl transition-colors duration-300
                ${borderClass}
                ${className}
                ${interactive ? `transition-all duration-200 ${hoverClass} hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer` : ''}
            `}
            style={{
                backgroundColor: bgColor,
                ...style
            }}
            onClick={onClick}
            data-testid={dataTestId}
        >
            {children}
        </div>
    )
}

export default GlassPanel

