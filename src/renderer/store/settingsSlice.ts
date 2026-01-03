import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

// 新主题模式类型
export type ThemeMode = 'minimal' | 'gradient' | 'wallpaper'

// 渐变变体类型
export type GradientVariant = 'single' | 'dual' | 'tri'

// 主题配置接口
export interface ThemeConfig {
    mode: ThemeMode

    // 透明度配置 (0-100)
    opacity: {
        background: number  // 背景透明度
        panel: number       // 主面板透明度
        modal: number       // 弹窗透明度
    }

    minimal: { variant: 'light' | 'dark' }
    gradient: { variant: GradientVariant; colors: string[] }
    wallpaper: { src: string; saved: string[] }
}

// 默认主题配置
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
    mode: 'gradient',
    opacity: {
        background: 100,  // 默认完全不透明
        panel: 70,        // 默认 70%
        modal: 95         // 默认 95%
    },
    minimal: { variant: 'light' },
    gradient: { variant: 'tri', colors: ['#ff9a9e', '#fecfef', '#feada6'] },
    wallpaper: { src: '', saved: [] }
}

export interface SettingsState {
    // 主题配置结构
    themeConfig: ThemeConfig

    // 其他配置
    language: 'zh' | 'en'
    autoLaunch: boolean
    shortcuts: {
        toggleMainWindow: string
        toggleCapsule: string
        createStickyNote: string
    }
    loaded: boolean

    // 笔记路径
    notesPath?: string

    // 复制格式
    copyFormat: 'text' | 'json' | 'markdown'
    copyTemplateTask: string
    copyTemplateSubtask: string

    // 面板布局
    panelLayouts: any[]

    // 用户头像
    avatarPath?: string

    // 周视图折叠状态
    weekViewCollapsed: boolean
}

const initialState: SettingsState = {
    themeConfig: DEFAULT_THEME_CONFIG,
    language: 'zh',
    autoLaunch: false,
    shortcuts: {
        toggleMainWindow: 'Ctrl+Shift+Z',
        toggleCapsule: 'Alt+Space',
        createStickyNote: 'Ctrl+Alt+N'
    },
    loaded: false,
    notesPath: undefined,
    copyFormat: 'text',
    copyTemplateTask: '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
    copyTemplateSubtask: '    {{index}}.{{title}}\n        {{description}}',
    panelLayouts: [],
    avatarPath: undefined,
    weekViewCollapsed: false
}

// 迁移旧主题设置到新结构
function migrateOldTheme(oldSettings: any): Partial<ThemeConfig> {
    if (oldSettings.themeConfig) {
        // 已经是新格式
        return oldSettings.themeConfig
    }

    // 旧格式迁移
    const oldTheme = oldSettings.theme
    const result: Partial<ThemeConfig> = {}

    switch (oldTheme) {
        case 'morning':
            result.mode = 'minimal'
            result.minimal = { variant: 'light' }
            break
        case 'night':
            result.mode = 'minimal'
            result.minimal = { variant: 'dark' }
            break
        case 'dual':
            result.mode = 'gradient'
            result.gradient = {
                variant: 'dual',
                colors: oldSettings.dualColors || ['#3b82f6', '#8b5cf6']
            }
            break
        case 'tri':
            result.mode = 'gradient'
            result.gradient = {
                variant: 'tri',
                colors: oldSettings.triColors || ['#3b82f6', '#8b5cf6', '#ec4899']
            }
            break
        case 'wallpaper':
            result.mode = 'wallpaper'
            result.wallpaper = {
                src: oldSettings.wallpaperPath || '',
                saved: oldSettings.recentWallpapers || []
            }
            break
    }

    return result
}

// 异步 Thunks
export const loadSettings = createAsyncThunk(
    'settings/load',
    async () => {
        if (!window.electronAPI) {
            console.log('Running in browser mode - using default settings')
            return {}
        }
        // Add 3s timeout to prevent infinite loading state
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Settings load timeout')), 3000))
        const settings = await Promise.race([window.electronAPI.getSettings(), timeout]) as any
        return settings
    }
)

export const saveSetting = createAsyncThunk(
    'settings/save',
    async ({ key, value }: { key: string; value: any }) => {
        if (window.electronAPI) {
            await window.electronAPI.setSetting(key, value)
        }
        return { key, value }
    }
)

// Slice
const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        // 新主题配置 reducers
        setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
            state.themeConfig.mode = action.payload
        },
        updateMinimalConfig: (state, action: PayloadAction<{ variant: 'light' | 'dark' }>) => {
            state.themeConfig.minimal = action.payload
            state.themeConfig.mode = 'minimal'
        },
        updateGradientConfig: (state, action: PayloadAction<{ variant?: GradientVariant; colors?: string[] }>) => {
            if (action.payload.variant !== undefined) {
                state.themeConfig.gradient.variant = action.payload.variant
            }
            if (action.payload.colors !== undefined) {
                state.themeConfig.gradient.colors = action.payload.colors
            }
            state.themeConfig.mode = 'gradient'
        },
        updateWallpaperConfig: (state, action: PayloadAction<{ src?: string; saved?: string[] }>) => {
            if (action.payload.src !== undefined) {
                state.themeConfig.wallpaper.src = action.payload.src
                state.themeConfig.mode = 'wallpaper' // Only change mode when setting src
            }
            if (action.payload.saved !== undefined) {
                state.themeConfig.wallpaper.saved = action.payload.saved
            }
        },
        // 仅更新壁纸保存列表，不改变当前模式
        setSavedWallpapers: (state, action: PayloadAction<string[]>) => {
            state.themeConfig.wallpaper.saved = action.payload
        },
        addSavedWallpaper: (state, action: PayloadAction<string>) => {
            const path = action.payload
            state.themeConfig.wallpaper.saved = [path, ...state.themeConfig.wallpaper.saved.filter(p => p !== path)].slice(0, 10)
            state.themeConfig.wallpaper.src = path
            state.themeConfig.mode = 'wallpaper'
        },
        removeSavedWallpaper: (state, action: PayloadAction<string>) => {
            const path = action.payload
            state.themeConfig.wallpaper.saved = state.themeConfig.wallpaper.saved.filter(p => p !== path)
            // 如果删除的是当前选中的壁纸，清空当前选中
            if (state.themeConfig.wallpaper.src === path) {
                state.themeConfig.wallpaper.src = state.themeConfig.wallpaper.saved[0] || ''
            }
        },

        // 透明度配置 reducers
        setBackgroundOpacity: (state, action: PayloadAction<number>) => {
            state.themeConfig.opacity.background = action.payload
        },
        setPanelOpacity: (state, action: PayloadAction<number>) => {
            state.themeConfig.opacity.panel = action.payload
        },
        setModalOpacity: (state, action: PayloadAction<number>) => {
            state.themeConfig.opacity.modal = action.payload
        },
        setLanguage: (state, action: PayloadAction<'zh' | 'en'>) => {
            state.language = action.payload
        },
        setAutoLaunch: (state, action: PayloadAction<boolean>) => {
            state.autoLaunch = action.payload
        },
        setShortcut: (state, action: PayloadAction<{ key: keyof SettingsState['shortcuts']; value: string }>) => {
            state.shortcuts[action.payload.key] = action.payload.value
        },
        setNotesPath: (state, action: PayloadAction<string>) => {
            state.notesPath = action.payload
        },
        setCopyFormat: (state, action: PayloadAction<'text' | 'json' | 'markdown'>) => {
            state.copyFormat = action.payload
        },
        setCopyTemplateTask: (state, action: PayloadAction<string>) => {
            state.copyTemplateTask = action.payload
        },
        setCopyTemplateSubtask: (state, action: PayloadAction<string>) => {
            state.copyTemplateSubtask = action.payload
        },
        setPanelLayouts: (state, action: PayloadAction<any[]>) => {
            state.panelLayouts = action.payload
        },
        setWeekViewCollapsed: (state, action: PayloadAction<boolean>) => {
            state.weekViewCollapsed = action.payload
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadSettings.fulfilled, (state, action) => {
                const settings = action.payload

                // 迁移并应用主题配置
                const migratedTheme = migrateOldTheme(settings)
                if (migratedTheme.mode) {
                    state.themeConfig = { ...state.themeConfig, ...migratedTheme }
                }

                // 如果已有新格式的 themeConfig，直接使用
                if (settings.themeConfig) {
                    state.themeConfig = { ...state.themeConfig, ...settings.themeConfig }
                }

                // 其他设置
                if (settings.language) state.language = settings.language
                if (settings.autoLaunch !== undefined) state.autoLaunch = settings.autoLaunch
                if (settings.shortcuts) state.shortcuts = { ...state.shortcuts, ...settings.shortcuts }
                if (settings.notes_path) state.notesPath = settings.notes_path

                if (settings.copyFormat) state.copyFormat = settings.copyFormat
                if (settings.copyTemplateTask) state.copyTemplateTask = settings.copyTemplateTask
                if (settings.copyTemplateSubtask) state.copyTemplateSubtask = settings.copyTemplateSubtask
                if (settings.panelLayouts) state.panelLayouts = settings.panelLayouts
                if (settings.avatarPath !== undefined) state.avatarPath = settings.avatarPath
                if (settings.weekViewCollapsed !== undefined) state.weekViewCollapsed = settings.weekViewCollapsed


                state.loaded = true
            })
            .addCase(saveSetting.fulfilled, (state, action) => {
                const { key, value } = action.payload
                if (key in state) {
                    (state as any)[key] = value
                }
            })
            .addCase(loadSettings.rejected, (state, action) => {
                console.error('Failed to load settings, using defaults:', action.error)
                state.loaded = true
            })
    }
})

export const {
    setThemeMode,
    updateMinimalConfig,
    updateGradientConfig,
    updateWallpaperConfig,
    setSavedWallpapers,
    addSavedWallpaper,
    removeSavedWallpaper,
    setBackgroundOpacity,
    setPanelOpacity,
    setModalOpacity,
    setLanguage,
    setAutoLaunch,
    setShortcut,
    setNotesPath,
    setCopyFormat,
    setCopyTemplateTask,
    setCopyTemplateSubtask,
    setPanelLayouts,
    setWeekViewCollapsed
} = settingsSlice.actions

export default settingsSlice.reducer
