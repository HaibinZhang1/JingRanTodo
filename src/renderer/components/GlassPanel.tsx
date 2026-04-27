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
 * 性能模式:
 * - best: 全部启用blur
 * - balanced: 主面板(panel)禁用blur，其他启用
 * - lite: 全部禁用blur
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
    const performanceMode = useAppSelector((state: RootState) => state.settings.performanceMode)

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

    // 根据性能模式和variant决定是否启用blur
    const shouldEnableBlur = (): boolean => {
        if (performanceMode === 'lite') return false
        if (performanceMode === 'balanced' && variant === 'panel') return false
        return true
    }

    const finalOpacity = getOpacity()
    const enableBlur = shouldEnableBlur()

    // 根据 isDark 计算背景色和边框色
    // 禁用blur时增加不透明度以保持视觉效果
    const adjustedOpacity = enableBlur ? finalOpacity : Math.min(finalOpacity + 20, 95)
    const bgColor = isDark
        ? `rgba(17, 24, 39, ${adjustedOpacity / 100})` // gray-900
        : `rgba(255, 255, 255, ${adjustedOpacity / 100})`

    const borderClass = isDark ? 'border-gray-700/50' : 'border-white/40'
    const hoverClass = isDark
        ? 'hover:bg-gray-800/70'
        : 'hover:bg-white/70'

    const blurClass = enableBlur ? 'backdrop-blur-xl' : ''


    return (
        <div
            className={`
                relative ${blurClass} border shadow-xl rounded-2xl transition-colors duration-300
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

