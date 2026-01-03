import { useEffect, useState, useRef } from 'react'
import { Minus, Square, X } from 'lucide-react'
import iconPng from '/icon.png?url'
import { useAppDispatch, useAppSelector } from './hooks/useRedux'
import { fetchTasks } from './store/tasksSlice'
import { fetchNotes, setPendingFullScreenId } from './store/notesSlice'
import { loadSettings } from './store/settingsSlice'
import { Sidebar, TaskDetailModal, PomodoroTimer, AvatarUploadModal, OnboardingCarousel } from './components'
import ExcelImportModal from './components/ExcelImportModal'
import TaskDashboard from './views/TaskDashboard'
import CalendarView from './views/CalendarView'
import SettingsView from './views/SettingsView'
import NotesView from './views/NotesView'
import RecurringTaskView from './views/RecurringTaskView'
import type { Task } from './store/tasksSlice'
import type { RootState } from './store'

export default function App() {
    const dispatch = useAppDispatch()
    const settings = useAppSelector((state: RootState) => state.settings)
    // Legacy support for themeConfig if it was destructured (updating to use settings directly)
    const { themeConfig, loaded } = settings

    const [activeTab, setActiveTab] = useState<'board' | 'calendar' | 'widget' | 'notes' | 'recurring'>('board')
    const [showSettings, setShowSettings] = useState(false)
    const [taskDetailOpen, setTaskDetailOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [showTimer, setShowTimer] = useState(false)
    const [activeCardIds, setActiveCardIds] = useState<string[]>([])
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
    const [isExcelImportOpen, setIsExcelImportOpen] = useState(false)
    const [panels, setPanels] = useState<{ id: string; title: string }[]>([])

    // 首次启动引导页状态
    const [showOnboarding, setShowOnboarding] = useState(() => {
        return !localStorage.getItem('zenboard_onboarding_done')
    })

    // 计算 isDark 派生状态
    const isDark = themeConfig.mode === 'minimal' && themeConfig.minimal.variant === 'dark'

    // 初始化：加载设置和任务
    useEffect(() => {
        try {
            dispatch(loadSettings())
            dispatch(fetchTasks())
            dispatch(fetchNotes())

            // 监听数据变化事件
            const unsubscribeTask = window.electronAPI?.onTaskDataChanged?.(() => {
                dispatch(fetchTasks())
                // 同时刷新面板列表（用于传给 ExcelImportModal 等）
                window.electronAPI?.getAllPanels?.().then((panelList) => {
                    if (panelList) setPanels(panelList)
                })
            })

            // 监听卡片列表变化
            const unsubscribeCards = window.electronAPI?.onCardListChanged?.((ids: string[]) => {
                setActiveCardIds(ids)
            })

            // 初始获取一次卡片列表
            window.electronAPI?.cardGetAll?.().then((ids) => {
                if (ids) setActiveCardIds(ids)
            })

            // 获取面板列表
            window.electronAPI?.getAllPanels?.().then((panelList) => {
                if (panelList) setPanels(panelList)
            })

            return () => {
                unsubscribeTask?.()
                unsubscribeCards?.()
            }
        } catch (e) {
            console.error('[App] Dispatch error:', e)
        }
    }, [dispatch])

    // 动态计算背景样式
    const getBackgroundStyle = (): React.CSSProperties => {
        const { mode, minimal, gradient, wallpaper } = themeConfig

        if (mode === 'minimal') {
            return {}
        }

        if (mode === 'gradient') {
            let colors: string[]
            if (gradient.variant === 'single') {
                colors = [gradient.colors[0], gradient.colors[0]]
            } else if (gradient.variant === 'dual') {
                colors = gradient.colors.slice(0, 2)
            } else {
                colors = gradient.colors.slice(0, 3)
            }
            return { background: `linear-gradient(135deg, ${colors.join(', ')})` }
        }

        if (mode === 'wallpaper' && wallpaper.src) {
            // 壁纸路径现在是相对路径如 /images/wallpapers/xxx.jpg
            return {
                backgroundImage: `url('${wallpaper.src}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }
        }

        return {}
    }

    // 计算背景类名
    const getBackgroundClass = () => {
        const { mode, minimal } = themeConfig

        if (mode === 'minimal') {
            return minimal.variant === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
        }
        if (mode === 'wallpaper') {
            return 'bg-cover bg-center'
        }
        return '' // gradient uses inline style
    }

    // 文字颜色类名
    const getTextClass = () => {
        return isDark ? 'text-gray-200' : 'text-gray-800'
    }

    const backgroundStyle = getBackgroundStyle()

    // 打开任务详情
    const handleOpenTaskDetail = (task?: Task, prefillTitle?: string, panelId?: string) => {
        if (task) {
            setEditingTask(task)
        } else if (prefillTitle) {
            setEditingTask({ title: prefillTitle, panel_id: panelId || null } as Task)
        } else {
            setEditingTask({ panel_id: panelId || null } as Task)
        }
        setTaskDetailOpen(true)
    }

    const handleOpenNoteFullScreen = (noteId: string) => {
        dispatch(setPendingFullScreenId({ id: noteId, source: 'board' }))
        setActiveTab('notes')
    }



    // 关闭任务详情
    const handleCloseTaskDetail = () => {
        setTaskDetailOpen(false)
        setEditingTask(null)
    }

    // 打开浮窗
    const handleOpenFloatWindow = async (panelType: string, title: string = "任务卡片") => {
        const cardId = `card-${panelType}`
        try {
            if (!window.electronAPI?.cardCreate) {
                console.error('electronAPI.cardCreate is missing')
                alert('API missing')
                return
            }
            await window.electronAPI.cardCreate({
                id: cardId,
                mode: 'floating',
                opacity: themeConfig.opacity.panel,
                title
            })
        } catch (err) {
            console.error('Failed to create card window:', err)
            alert('开启浮窗失败: ' + (err as any)?.message)
        }
    }

    // 自定义标题栏
    const TitleBar = () => {
        const handleDoubleClick = (e: React.MouseEvent) => {
            // 忽略按钮区域和 no-drag 区域
            if ((e.target as HTMLElement).closest('button')) return
            if ((e.target as HTMLElement).closest('[data-no-drag]')) return
            window.electronAPI?.windowMaximize()
        }

        return (
            <div
                className={`h-8 flex items-center justify-between px-3 backdrop-blur-sm border-b transition-colors relative
                ${isDark ? 'bg-gray-900/30 border-white/10' : 'bg-white/30 border-white/20'}`}
                style={{ WebkitAppRegion: 'drag' } as any}
                onDoubleClick={handleDoubleClick}>
                <div className="flex items-center gap-2" data-no-drag style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <img src={iconPng} alt="Icon" className="w-5 h-5" />
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}></span>
                </div>
                <div className="flex items-center gap-1" data-no-drag style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={() => window.electronAPI?.windowMinimize()}
                        className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white/40 text-gray-600'}`}
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        onClick={() => window.electronAPI?.windowMaximize()}
                        className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white/40 text-gray-600'}`}
                    >
                        <Square size={10} />
                    </button>
                    <button
                        onClick={() => window.electronAPI?.windowClose()}
                        className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-red-500/60 hover:text-white text-gray-400' : 'hover:bg-red-400/60 hover:text-white text-gray-600'}`}
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>
        )
    }

    // 加载中
    if (!loaded) {
        return (
            <div className={`w-full h-screen flex items-center justify-center ${getBackgroundClass()}`} style={backgroundStyle}>
                <div className="animate-pulse">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-xl p-2">
                        <img src={iconPng} alt="Loading" className="w-full h-full object-contain" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`w-full h-screen font-sans overflow-hidden flex flex-col relative transition-all duration-700 rounded-lg ${getTextClass()} ${isDark ? 'dark' : ''}`}
        >
            {/* Background Layer */}
            <div
                className={`absolute inset-0 z-[-1] transition-all duration-700 rounded-lg overflow-hidden ${getBackgroundClass()}`}
                style={{
                    ...backgroundStyle,
                    opacity: themeConfig.opacity.background / 100
                }}
            >
                {/* Noise overlay for dithering gradient banding */}
                {themeConfig.mode === 'gradient' && (
                    <div
                        className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                        }}
                    />
                )}
            </div>

            <TitleBar />

            <div className="flex-1 flex overflow-hidden relative">
                <Sidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onOpenSettings={() => setShowSettings(true)}
                    onToggleTimer={() => setShowTimer(!showTimer)}
                    onOpenImport={() => {
                        // 先刷新面板列表，确保获取最新数据
                        window.electronAPI?.getAllPanels?.().then((panelList) => {
                            if (panelList) setPanels(panelList)
                        })
                        setIsExcelImportOpen(true)
                    }}
                    opacity={themeConfig.opacity.panel}
                    isDark={isDark}
                    avatarPath={settings.avatarPath}
                    onAvatarClick={() => setIsAvatarModalOpen(true)}
                />

                {showTimer && (
                    <div className="absolute left-20 bottom-4 z-40 animate-fade-in-up">
                        <PomodoroTimer />
                    </div>
                )}

                <div className="flex-1 h-full py-4 pr-4 overflow-hidden flex flex-col">
                    {activeTab === 'board' && (
                        <TaskDashboard
                            onOpenTaskDetail={handleOpenTaskDetail}
                            onOpenFloatWindow={handleOpenFloatWindow}
                            onOpenNoteFullScreen={handleOpenNoteFullScreen}
                            activeCardIds={activeCardIds}
                            isDark={isDark}
                        />
                    )}
                    {activeTab === 'calendar' && (
                        <CalendarView onOpenTaskDetail={handleOpenTaskDetail} isDark={isDark} />
                    )}
                    {activeTab === 'notes' && (
                        <NotesView
                            isDark={isDark}
                            onExitFullScreen={() => setActiveTab('board')}
                        />
                    )}
                    {activeTab === 'widget' && (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            桌面挂件预览 - 开发中...
                        </div>
                    )}
                    {activeTab === 'recurring' && (
                        <RecurringTaskView isDark={isDark} />
                    )}
                </div>
            </div>



            <TaskDetailModal
                task={editingTask as any}
                isOpen={taskDetailOpen}
                onClose={handleCloseTaskDetail}
            />

            <SettingsView isOpen={showSettings} onClose={() => setShowSettings(false)} isDark={isDark} />

            <AvatarUploadModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                onSave={() => dispatch(loadSettings())}
                currentAvatar={settings.avatarPath}
                opacity={themeConfig.opacity.modal}
                isDark={isDark}
            />

            <ExcelImportModal
                isOpen={isExcelImportOpen}
                onClose={() => {
                    setIsExcelImportOpen(false)
                    // 刷新面板列表
                    window.electronAPI?.getAllPanels?.().then((panelList) => {
                        if (panelList) setPanels(panelList)
                    })
                }}
                existingPanels={panels}
                isDark={isDark}
            />

            {/* 首次启动引导页 */}
            {showOnboarding && (
                <OnboardingCarousel
                    isDark={isDark}
                    onComplete={() => {
                        localStorage.setItem('zenboard_onboarding_done', 'true')
                        setShowOnboarding(false)
                    }}
                />
            )}
        </div>
    )
}
