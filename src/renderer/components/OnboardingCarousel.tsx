import React, { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Briefcase, Calendar, Layout, FileText, Sparkles, RefreshCw, ExternalLink, StickyNote } from 'lucide-react'
import { GlassPanel } from './GlassPanel'

interface OnboardingCarouselProps {
    onComplete: () => void
    isDark?: boolean
}

interface SlideContent {
    icon: React.ReactNode
    title: string
    description: string
    features?: string[]
    iconBg: string
    iconColor: string
}

const slides: SlideContent[] = [
    {
        icon: <Sparkles size={32} />,
        title: '欢迎使用井然',
        description: '一款优雅的任务管理与效率工具，帮助你井然有序地规划每一天。',
        features: ['简洁美观的界面', '强大的任务管理', '灵活的自定义面板'],
        iconBg: 'bg-gradient-to-br from-blue-500 to-purple-500',
        iconColor: 'text-white'
    },
    {
        icon: <Briefcase size={32} />,
        title: '今日待办',
        description: '快速添加和管理今天要完成的任务，让每一天都高效充实。',
        features: ['一键添加任务', '拖拽排序优先级', '子任务分解', '任务置顶'],
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
        icon: <Calendar size={32} />,
        title: '周视图',
        description: '以周为单位概览任务分布，合理安排工作与生活。',
        features: ['一周任务一目了然', '快速跨日拖拽', '日期快捷导航'],
        iconBg: 'bg-green-100 dark:bg-green-900/40',
        iconColor: 'text-green-600 dark:text-green-400'
    },
    {
        icon: <Layout size={32} />,
        title: '自定义面板',
        description: '创建专属任务分类，按项目、领域或任意方式组织你的任务。',
        features: ['自由命名面板', '独立任务列表', '面板浮窗模式'],
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
        iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
        icon: <RefreshCw size={32} />,
        title: '周期任务',
        description: '设置每日、每周或每月重复的任务，自动生成今日待办。',
        features: ['灵活周期设置', '自动生成任务', '统一管理入口'],
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400'
    },
    {
        icon: <ExternalLink size={32} />,
        title: '任务卡片浮窗',
        description: '将任务面板以浮窗形式独立显示，边工作边查看任务。',
        features: ['悬浮桌面显示', '透明度可调', '多面板同时浮起'],
        iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
        iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
        icon: <StickyNote size={32} />,
        title: '笔记浮窗',
        description: '随时打开笔记浮窗，记录灵感与想法，支持 Markdown 格式。',
        features: ['Markdown 支持', '浮窗快速编辑', '主页面板展示'],
        iconBg: 'bg-rose-100 dark:bg-rose-900/40',
        iconColor: 'text-rose-600 dark:text-rose-400'
    },
    {
        icon: <FileText size={32} />,
        title: '准备就绪',
        description: '现在开始，让每一天都井然有序！',
        features: ['开启高效之旅', '探索更多功能', '尽在设置中心'],
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
        iconColor: 'text-white'
    }
]

export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ onComplete, isDark = false }) => {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [direction, setDirection] = useState<'left' | 'right'>('right')
    const [isAnimating, setIsAnimating] = useState(false)

    const goToSlide = useCallback((index: number) => {
        if (isAnimating || index === currentSlide) return
        setDirection(index > currentSlide ? 'right' : 'left')
        setIsAnimating(true)
        setTimeout(() => {
            setCurrentSlide(index)
            setIsAnimating(false)
        }, 200)
    }, [currentSlide, isAnimating])

    const goNext = useCallback(() => {
        if (currentSlide < slides.length - 1) {
            goToSlide(currentSlide + 1)
        }
    }, [currentSlide, goToSlide])

    const goPrev = useCallback(() => {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1)
        }
    }, [currentSlide, goToSlide])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goNext()
            else if (e.key === 'ArrowLeft') goPrev()
            else if (e.key === 'Escape') onComplete()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goNext, goPrev, onComplete])

    const slide = slides[currentSlide]
    const isLastSlide = currentSlide === slides.length - 1

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <GlassPanel
                isDark={isDark}
                variant="modal"
                className="w-[960px] max-w-[90vw] max-h-[85vh] overflow-hidden"
            >
                {/* Header with Skip Button */}
                <div className="flex items-center justify-between px-6 pt-5 pb-2">
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {currentSlide + 1} / {slides.length}
                    </span>
                    <button
                        onClick={onComplete}
                        className={`p-1.5 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-white/10 text-gray-400 hover:text-gray-200'
                            : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-8 pb-6">
                    <div
                        className={`transition-all duration-200 ease-out ${isAnimating
                            ? direction === 'right'
                                ? 'opacity-0 translate-x-4'
                                : 'opacity-0 -translate-x-4'
                            : 'opacity-100 translate-x-0'
                            }`}
                    >
                        {/* Icon */}
                        <div className="flex justify-center mb-5">
                            <div className={`p-4 rounded-2xl shadow-lg ${slide.iconBg} ${slide.iconColor}`}>
                                {slide.icon}
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className={`text-2xl font-bold text-center mb-3 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                            {slide.title}
                        </h2>

                        {/* Description */}
                        <p className={`text-center mb-5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {slide.description}
                        </p>

                        {/* Features */}
                        {slide.features && (
                            <div className="flex flex-wrap justify-center gap-2">
                                {slide.features.map((feature, i) => (
                                    <span
                                        key={i}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDark
                                            ? 'bg-white/10 text-gray-300'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <div className={`px-6 py-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200/60'}`}>
                    {/* Dots */}
                    <div className="flex items-center justify-center gap-1.5 mb-4">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`transition-all duration-200 rounded-full ${index === currentSlide
                                    ? `w-6 h-1.5 ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`
                                    : `w-1.5 h-1.5 ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'}`
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-center gap-3">
                        {currentSlide > 0 && (
                            <button
                                onClick={goPrev}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium transition-colors ${isDark
                                    ? 'bg-white/10 hover:bg-white/15 text-gray-300'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }`}
                            >
                                <ChevronLeft size={16} />
                                上一步
                            </button>
                        )}

                        {isLastSlide ? (
                            <button
                                onClick={onComplete}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                            >
                                <Sparkles size={16} />
                                开始使用
                            </button>
                        ) : (
                            <button
                                onClick={goNext}
                                className="flex items-center gap-1.5 px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow transition-colors"
                            >
                                下一步
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </GlassPanel>
        </div>
    )
}

export default OnboardingCarousel
