import React from 'react'
import { Layout, Calendar, Settings, Timer, Book, CalendarClock, FileUp } from 'lucide-react'
import GlassPanel from './GlassPanel'
import iconPng from '/icon.png?url'

interface SidebarProps {
    activeTab: 'board' | 'calendar' | 'widget' | 'notes' | 'recurring'
    onTabChange: (tab: 'board' | 'calendar' | 'widget' | 'notes' | 'recurring') => void
    onOpenSettings: () => void
    onToggleTimer: () => void
    onOpenImport?: () => void
    opacity?: number
    isDark?: boolean
    avatarPath?: string
    onAvatarClick?: () => void
}

/**
 * 侧边栏导航组件
 * 支持暗色模式适配
 */
export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    onTabChange,
    onOpenSettings,
    onToggleTimer,
    onOpenImport,
    opacity = 60,
    isDark = false,
    avatarPath,
    onAvatarClick
}) => {
    const iconSrc = iconPng

    const navItems = [
        { id: 'board' as const, icon: Layout, label: '任务' },
        { id: 'calendar' as const, icon: Calendar, label: '日历' },
        { id: 'notes' as const, icon: Book, label: '笔记' },
        { id: 'recurring' as const, icon: CalendarClock, label: '周期任务' },
    ]

    // 暗色模式下的样式
    const getButtonClass = (isActive: boolean) => {
        if (isActive) {
            return isDark
                ? 'bg-gray-700 text-white shadow-sm'
                : 'bg-white/60 dark:bg-gray-800/60 text-blue-600 dark:text-blue-400 shadow-sm'
        }
        return isDark
            ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            : 'text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-800/40'
    }

    return (
        <GlassPanel
            opacity={opacity}
            isDark={isDark}
            className="w-16 min-w-[4rem] flex flex-col items-center py-4 gap-4 max-h-[calc(100vh-32px)] mx-4 my-4 shrink-0 z-20 border-white/20 dark:border-gray-700"
            data-testid="sidebar"
        >
            {/* Logo / Avatar */}
            <button
                onClick={onAvatarClick}
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg mb-4 overflow-hidden"
            >
                {avatarPath ? (
                    <img src={avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <img src={iconSrc} alt="井然" className="w-full h-full object-cover" />
                )}
            </button>

            {/* 导航按钮 */}
            {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`p-3 rounded-xl transition-all relative group ${getButtonClass(activeTab === item.id)}`}
                    title={item.label}
                    data-testid={`nav-${item.id}`}
                >
                    <item.icon size={22} />
                    {/* Tooltip */}
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {item.label}
                    </span>
                </button>
            ))}

            {/* 分隔线 */}
            <div className={`w-8 h-px ${isDark ? 'bg-gray-600' : 'bg-gray-300/50 dark:bg-gray-600'}`}></div>



            {/* 底部设置按钮 */}
            <div className="mt-auto flex flex-col gap-4">
                <button
                    onClick={onOpenImport}
                    className={`p-3 rounded-xl transition-all relative group ${isDark ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                    title="导入任务"
                    data-testid="btn-import"
                >
                    <FileUp size={22} />
                    {/* Tooltip */}
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        导入任务
                    </span>
                </button>
                <button
                    onClick={onToggleTimer}
                    className={`p-3 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                    title="番茄钟"
                    data-testid="btn-timer"
                >
                    <Timer size={22} />
                </button>
                <button
                    onClick={onOpenSettings}
                    className={`p-3 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                    title="设置"
                    data-testid="btn-settings"
                >
                    <Settings size={22} />
                </button>
            </div>
        </GlassPanel>
    )
}

export default Sidebar
