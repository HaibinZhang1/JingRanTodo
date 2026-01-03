/**
 * CustomPanelGrid - 使用 CSS Grid + @dnd-kit 实现的面板网格
 * 按照 重构.md 规范实现
 * 
 * 功能：
 * - 最多6个面板
 * - 自适应布局：1个占满，2个左右各半，3-4个2x2，5-6个2x3带滚动
 * - 支持拖拽排序（按住标题栏）
 * - 交换动画效果
 * - 5-6个面板时出现垂直滚动条
 */
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LayoutGrid, Plus, Sparkles } from 'lucide-react'
import { useAppSelector } from '../hooks/useRedux'
import { RootState } from '../store'

interface CustomPanelGridProps {
    children: React.ReactNode[]
    onOrderChange?: (newOrder: string[]) => void
    className?: string
    maxPanels?: number
    showAddButton?: boolean
    onAddPanel?: () => void
    canAddMore?: boolean
}

// 可排序的面板包装器
interface SortablePanelProps {
    id: string
    children: React.ReactNode
    panelCount: number
    index: number
    isNew?: boolean
}

function SortablePanel({ id, children, panelCount, index, isNew }: SortablePanelProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease, opacity 200ms ease',
        opacity: isDragging ? 0.5 : 1,
        minHeight: '200px',
        height: '100%', // 确保高度撑满
        zIndex: isDragging ? 100 : 1,
        // 新增面板动画
        animation: isNew ? 'panelEnter 300ms ease-out' : undefined,
        // Flexbox 布局优化
        flexShrink: 0,
        minWidth: '310px', // 强制最小宽度，防止缩放时重叠
        width: panelCount === 1 ? '100%' :
            panelCount === 2 ? 'calc(50% - 6px)' :
                'calc(33.33% - 8px)',
    }

    // 递归地将 dragListeners 和 isDragging 传递给子组件
    const childWithProps = React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child

        // 如果子元素是 div 或其他容器，需要查看其内部子元素
        const childElement = child as React.ReactElement<any>
        const childChildren = childElement.props.children

        if (childChildren && React.isValidElement(childChildren)) {
            // 如果子元素包含一个可以接收 props 的组件
            const innerChild = React.cloneElement(childChildren as React.ReactElement, {
                dragListeners: listeners,
                isDragging,
            })
            return React.cloneElement(childElement, {}, innerChild)
        }

        // 直接对子元素注入 props（如果子组件本身支持这些 props）
        return React.cloneElement(childElement, {
            dragListeners: listeners,
            isDragging,
        })
    })

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className="h-full"
        >
            {childWithProps}
        </div>
    )
}

// 拖拽覆盖层显示
function DragOverlayPanel({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="h-full opacity-90 shadow-2xl rounded-2xl scale-105"
            style={{
                transform: 'rotate(2deg)',
                pointerEvents: 'none',
            }}
        >
            {children}
        </div>
    )
}

export const CustomPanelGrid: React.FC<CustomPanelGridProps> = ({
    children,
    onOrderChange,
    className,
    maxPanels = 6,
    showAddButton = true,
    onAddPanel,
    canAddMore = true,
}) => {
    // 获取面板透明度设置
    const themeConfig = useAppSelector((state: RootState) => state.settings.themeConfig)
    const panelOpacity = themeConfig.opacity.panel / 100 // 转换为 0-1 范围

    const [isHovering, setIsHovering] = useState(false)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [newPanelIds, setNewPanelIds] = useState<Set<string>>(new Set())

    // 悬浮按钮位置与拖拽状态 - 使用百分比存储（相对于可视区域）
    const [addButtonPosPercent, setAddButtonPosPercent] = useState({ xPercent: 95, yPercent: 5 })
    const [isDraggingAddButton, setIsDraggingAddButton] = useState(false)
    const [isPositionLoaded, setIsPositionLoaded] = useState(false)
    const [scrollLeft, setScrollLeft] = useState(0)
    const [showTooltip, setShowTooltip] = useState(false)
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; xPercent: number; yPercent: number } | null>(null)
    const wasDraggingRef = useRef(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // 将百分比位置转换为实际像素位置（相对于可视区域）
    const getButtonPixelPosition = useCallback(() => {
        if (!containerRef.current) return { x: 0, y: 0 }
        const rect = containerRef.current.getBoundingClientRect()
        const buttonSize = 44 // 按钮尺寸
        // x 和 y 都是相对于可视区域的百分比
        const x = Math.max(8, Math.min((addButtonPosPercent.xPercent / 100) * rect.width, rect.width - buttonSize - 8))
        const y = Math.max(8, Math.min((addButtonPosPercent.yPercent / 100) * rect.height, rect.height - buttonSize - 8))
        return { x, y }
    }, [addButtonPosPercent])

    // 加载按钮位置（百分比）
    useEffect(() => {
        const loadPosition = () => {
            const savedPos = localStorage.getItem('zenhubboard_add_panel_btn_pos_v2')
            if (savedPos) {
                try {
                    const parsed = JSON.parse(savedPos)
                    if (typeof parsed.xPercent === 'number' && typeof parsed.yPercent === 'number') {
                        setAddButtonPosPercent(parsed)
                        setIsPositionLoaded(true)
                        return true
                    }
                } catch (e) {
                    console.error('Failed to parse saved position', e)
                }
            }
            // 默认位置：右上角
            setAddButtonPosPercent({ xPercent: 92, yPercent: 5 })
            setIsPositionLoaded(true)
            return true
        }

        loadPosition()
    }, [])

    // 监听滚动容器的滚动事件
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current
        if (!scrollContainer) return

        const handleScroll = () => {
            setScrollLeft(scrollContainer.scrollLeft)
        }

        scrollContainer.addEventListener('scroll', handleScroll)
        return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }, [])

    // 处理按钮拖拽
    const handleAddButtonMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            xPercent: addButtonPosPercent.xPercent,
            yPercent: addButtonPosPercent.yPercent
        }
        setIsDraggingAddButton(true)
    }

    useEffect(() => {
        if (!isDraggingAddButton) return

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStartRef.current || !containerRef.current) return

            const dx = e.clientX - dragStartRef.current.mouseX
            const dy = e.clientY - dragStartRef.current.mouseY

            // 如果位移超过 5px，判定为拖拽
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                wasDraggingRef.current = true
            }

            const rect = containerRef.current.getBoundingClientRect()

            // 将像素增量转换为百分比增量
            const dxPercent = (dx / rect.width) * 100
            const dyPercent = (dy / rect.height) * 100

            let newXPercent = dragStartRef.current.xPercent + dxPercent
            let newYPercent = dragStartRef.current.yPercent + dyPercent

            // 边界限制（百分比）
            newXPercent = Math.max(2, Math.min(newXPercent, 95))
            newYPercent = Math.max(2, Math.min(newYPercent, 85))

            setAddButtonPosPercent({ xPercent: newXPercent, yPercent: newYPercent })
        }

        const handleMouseUp = () => {
            setIsDraggingAddButton(false)
            dragStartRef.current = null
            // 保存百分比位置
            localStorage.setItem('zenhubboard_add_panel_btn_pos_v2', JSON.stringify(addButtonPosPercent))

            // 延迟清空，确保点击事件能看到这个标记
            setTimeout(() => {
                wasDraggingRef.current = false
            }, 100)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDraggingAddButton, addButtonPosPercent])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // 提取所有面板的 ID
    const panelIds = useMemo(() => {
        const ids: string[] = []
        React.Children.forEach(children, (child: any) => {
            if (child?.key) {
                ids.push(child.key)
            }
        })
        return ids
    }, [children])

    // 使用 ref 追踪已知的面板 ID，避免重复触发动画
    const knownPanelIdsRef = useRef<Set<string>>(new Set())

    // 检测新增的面板并添加动画
    useEffect(() => {
        const knownIds = knownPanelIdsRef.current
        const newIds: string[] = []

        // 找出真正新增的面板
        panelIds.forEach(id => {
            if (!knownIds.has(id)) {
                newIds.push(id)
                knownIds.add(id)
            }
        })

        // 更新已知面板集合（移除已删除的）
        knownIds.forEach(id => {
            if (!panelIds.includes(id)) {
                knownIds.delete(id)
            }
        })

        // 只对新增的面板添加动画标记
        if (newIds.length > 0) {
            setNewPanelIds(prev => new Set([...prev, ...newIds]))

            // 300ms后移除动画标记
            setTimeout(() => {
                setNewPanelIds(prev => {
                    const next = new Set(prev)
                    newIds.forEach(id => next.delete(id))
                    return next
                })
            }, 300)
        }
    }, [panelIds])

    const panelCount = panelIds.length

    // 获取当前拖拽的元素
    const activeChild = useMemo(() => {
        if (!activeId) return null
        return React.Children.toArray(children).find(
            (child: any) => child?.key === activeId
        )
    }, [activeId, children])

    // 处理拖拽开始
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    // 处理拖拽结束
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        setActiveId(null)

        if (over && active.id !== over.id) {
            const oldIndex = panelIds.indexOf(active.id as string)
            const newIndex = panelIds.indexOf(over.id as string)
            const newOrder = arrayMove(panelIds, oldIndex, newIndex)
            onOrderChange?.(newOrder)
        }
    }

    // 处理鼠标滚轮横向滚动
    const handleWheel = (e: React.WheelEvent) => {
        if (scrollContainerRef.current) {
            // 检查事件是否来自内部可滚动元素（如任务列表）
            const target = e.target as HTMLElement
            let current: HTMLElement | null = target

            // 向上遍历父元素，检查是否有可滚动的容器
            while (current && current !== scrollContainerRef.current) {
                // 如果是可垂直滚动的元素，不转换滚动
                if (current.scrollHeight > current.clientHeight &&
                    window.getComputedStyle(current).overflowY !== 'hidden' &&
                    window.getComputedStyle(current).overflowY !== 'visible') {
                    return // 让事件正常传播，不做转换
                }
                current = current.parentElement
            }

            // 如果纵向滚动量大于横向，且容器可以横向滚动，则拦截
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                const container = scrollContainerRef.current
                if (container.scrollWidth > container.clientWidth) {
                    e.preventDefault()
                    container.scrollLeft += e.deltaY
                }
            }
        }
    }

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: '12px',
        height: '100%',
        position: 'relative',
        overflowX: 'auto', // 始终允许溢出，由 CSS 控制滚动条外观
        overflowY: 'hidden',
        // 注意：不添加 paddingBottom，以保持与左侧面板高度一致
    }

    return (
        <div
            ref={containerRef}
            className={`relative ${className || ''}`}
            style={{ height: '100%' }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* 悬浮新增按钮 - 更美观的设计 */}
            {showAddButton && canAddMore && (() => {
                const buttonPos = getButtonPixelPosition()
                return (
                    <div
                        style={{
                            left: buttonPos.x,
                            top: buttonPos.y,
                            visibility: isPositionLoaded ? 'visible' : 'hidden'
                        }}
                        className={`
                            absolute z-50
                            ${isDraggingAddButton ? 'z-[100]' : ''}
                            ${(isHovering || isDraggingAddButton) ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
                            transition-all duration-300 ease-out
                        `}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        {/* Tooltip */}
                        <div
                            className={`
                                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                px-3 py-1.5 rounded-lg
                                bg-gray-800/95 text-white text-xs font-medium
                                whitespace-nowrap
                                backdrop-blur-sm
                                shadow-lg
                                transition-all duration-200
                                ${showTooltip && !isDraggingAddButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
                            `}
                        >
                            新增卡片 ({panelCount}/{maxPanels})
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800/95" />
                        </div>

                        {/* Button */}
                        <button
                            onClick={() => {
                                if (wasDraggingRef.current) return
                                onAddPanel?.()
                            }}
                            onMouseDown={handleAddButtonMouseDown}
                            style={{
                                backgroundColor: `rgba(255, 255, 255, ${panelOpacity * 0.6})`
                            }}
                            className={`
                                relative
                                flex items-center justify-center
                                w-11 h-11
                                backdrop-blur-xl
                                text-gray-700 dark:text-gray-200
                                rounded-xl
                                shadow-lg shadow-black/10
                                border border-white/40 dark:border-white/20
                                hover:shadow-xl hover:scale-110 hover:border-white/60
                                active:scale-95
                                transition-all duration-300 ease-out
                                group
                                ${isDraggingAddButton ? 'cursor-grabbing scale-105 shadow-2xl' : 'cursor-grab'}
                            `}
                        >
                            {/* Icon container with glow effect */}
                            <div className="relative flex items-center justify-center">
                                {/* Background glow */}
                                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-sm group-hover:bg-blue-500/30 transition-all duration-300" />

                                {/* Main icon - LayoutGrid with Plus overlay */}
                                <div className="relative">
                                    <LayoutGrid
                                        size={18}
                                        className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200"
                                        strokeWidth={2}
                                    />
                                    {/* Plus badge */}
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 shadow-sm">
                                        <Plus
                                            size={8}
                                            className="text-white"
                                            strokeWidth={3}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sparkle effect on hover */}
                            <Sparkles
                                size={10}
                                className="absolute top-1 right-1 text-yellow-300/0 group-hover:text-yellow-300/80 transition-all duration-300 group-hover:animate-pulse"
                            />
                        </button>
                    </div>
                )
            })()}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={panelIds} strategy={horizontalListSortingStrategy}>
                    <div
                        ref={scrollContainerRef}
                        style={containerStyle}
                        className="custom-scrollbar"
                        onWheel={handleWheel}
                    >
                        {panelCount === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400 w-full">
                                <div className="text-center">
                                    <div className="text-4xl mb-2">📋</div>
                                    <p>暂无自定义看板</p>
                                    {canAddMore && (
                                        <button
                                            onClick={onAddPanel}
                                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                        >
                                            创建第一个看板
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            React.Children.map(children, (child, index) => {
                                if (!child || !(child as any).key) return null
                                const id = (child as any).key
                                const isNew = newPanelIds.has(id)
                                return (
                                    <SortablePanel
                                        key={id}
                                        id={id}
                                        panelCount={panelCount}
                                        index={index}
                                        isNew={isNew}
                                    >
                                        {child}
                                    </SortablePanel>
                                )
                            })
                        )}
                    </div>
                </SortableContext>

                {/* 拖拽覆盖层 */}
                <DragOverlay dropAnimation={{
                    duration: 250,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                    {activeChild ? (
                        <DragOverlayPanel>
                            {activeChild}
                        </DragOverlayPanel>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* CSS动画与滚动条 definition */}
            <style>{`
                @keyframes panelEnter {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateX(0);
                    }
                }
                
                /* 完全隐藏滚动条，但保留滚动功能 - 解决左右栏底部不对齐问题 */
                .custom-scrollbar {
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* IE/Edge */
                }
                .custom-scrollbar::-webkit-scrollbar {
                    display: none; /* Chrome/Safari/Opera */
                    height: 0;
                    width: 0;
                }
            `}</style>
        </div>
    )
}

export default CustomPanelGrid
