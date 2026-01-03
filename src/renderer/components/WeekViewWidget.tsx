import React, { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
// @ts-ignore
import { X, GripHorizontal } from 'lucide-react'
import { GlassPanel } from './GlassPanel'
import { WeekViewSection } from './WeekViewSection'

export const WeekViewWidget: React.FC = () => {
    const tasks = useSelector((state: any) => state.tasks?.items || [])

    const [isDragging, setIsDragging] = useState(false)

    // Drag state
    const dragStartPos = useRef<{ x: number, y: number } | null>(null)
    const windowStartPos = useRef<{ x: number, y: number } | null>(null)
    const currentPos = useRef<{ x: number, y: number } | null>(null)
    const animationFrameId = useRef<number | null>(null)

    // 使用 ref 来追踪拖动状态，避免闭包问题
    const isDraggingRef = useRef(false)

    // Handle Window Drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return

        isDraggingRef.current = true
        setIsDragging(true)
        dragStartPos.current = { x: e.screenX, y: e.screenY }
        windowStartPos.current = { x: window.screenX, y: window.screenY }
        currentPos.current = { x: window.screenX, y: window.screenY }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !dragStartPos.current || !windowStartPos.current) return

        const dx = e.screenX - dragStartPos.current.x
        const dy = e.screenY - dragStartPos.current.y

        const newX = windowStartPos.current.x + dx
        const newY = windowStartPos.current.y + dy

        currentPos.current = { x: newX, y: newY }

        // Throttled IPC
        if (!animationFrameId.current) {
            animationFrameId.current = requestAnimationFrame(() => {
                window.electronAPI.weekViewWidgetMove(Math.round(newX), Math.round(newY))
                animationFrameId.current = null
            })
        }
    }

    const handleMouseUp = () => {
        if (!isDraggingRef.current) return

        isDraggingRef.current = false
        setIsDragging(false)

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current)
            animationFrameId.current = null
        }

        // Final position update
        if (currentPos.current) {
            const { x, y } = currentPos.current
            window.electronAPI.weekViewWidgetMove(Math.round(x), Math.round(y))
        }
    }

    return (
        <div
            className="h-screen w-screen bg-transparent overflow-hidden"
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={isDragging ? handleMouseUp : undefined}
            onMouseLeave={isDragging ? handleMouseUp : undefined}
        >
            {/* 浮窗内容 */}
            <div className="fixed inset-0 flex flex-col">
                <GlassPanel
                    className="flex-1 flex flex-col rounded-xl overflow-hidden shadow-xl border border-white/20 relative"
                    opacity={90}
                >
                    {/* Header / Drag Handle */}
                    <div
                        className="h-8 flex items-center justify-between px-2 bg-white/10 cursor-move shrink-0"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 pointer-events-none">
                            <GripHorizontal size={14} />
                            <span className="text-xs font-bold">周视图</span>
                        </div>
                        <div className="flex items-center no-drag">
                            <button
                                onClick={() => window.electronAPI.weekViewWidgetClose()}
                                className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors text-gray-500"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* WeekView Content */}
                    <div className="flex-1 overflow-hidden relative">
                        <WeekViewSection
                            tasks={tasks}
                            className="h-full border-none shadow-none bg-transparent"
                        />
                    </div>

                    {/* Resize Handle (Bottom Right) */}
                    <div
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 no-drag"
                        onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.screenX
                            const startY = e.screenY
                            const startW = window.innerWidth
                            const startH = window.innerHeight

                            const onMove = (moveEvent: MouseEvent) => {
                                const w = startW + (moveEvent.screenX - startX)
                                const h = startH + (moveEvent.screenY - startY)
                                window.electronAPI.weekViewWidgetResize(w, h)
                            }
                            const onUp = () => {
                                document.removeEventListener('mousemove', onMove)
                                document.removeEventListener('mouseup', onUp)
                            }
                            document.addEventListener('mousemove', onMove)
                            document.addEventListener('mouseup', onUp)
                        }}
                    />
                </GlassPanel>
            </div>
        </div>
    )
}

export default WeekViewWidget
