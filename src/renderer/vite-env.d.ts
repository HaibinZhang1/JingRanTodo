/// <reference types="vite/client" />

interface ElectronAPI {
    // Window controls
    windowMinimize: () => void
    windowMaximize: () => void
    windowClose: () => void

    // Task management
    getAllTasks: () => Promise<any[]>
    getTask: (id: string) => Promise<any>
    createTask: (task: any) => Promise<any>
    updateTask: (task: any) => Promise<any>
    deleteTask: (id: string) => Promise<boolean>
    getSubtasks: (taskId: string) => Promise<any[]>
    createSubtask: (subtask: any) => Promise<any>
    updateSubtask: (subtask: any) => Promise<any>
    deleteSubtask: (id: string) => Promise<boolean>

    // Panel management
    getAllPanels: () => Promise<any[]>
    createPanel: (panel: any) => Promise<any>
    updatePanel: (panel: any) => Promise<any>
    deletePanel: (id: string) => Promise<boolean>

    // Recurring templates
    getAllRecurringTemplates: () => Promise<any[]>
    createRecurringTemplate: (template: any) => Promise<any>
    updateRecurringTemplate: (template: any) => Promise<any>
    deleteRecurringTemplate: (id: string) => Promise<boolean>
    checkRecurringTasks: () => Promise<{ generated: number; templates: string[] }>

    // Settings
    getSettings: () => Promise<Record<string, any>>
    setSetting: (key: string, value: any) => Promise<boolean>

    // Events
    onQuickAddTask: (callback: () => void) => () => void
    onTaskDataChanged: (callback: () => void) => () => void
    onCardListChanged: (callback: (ids: string[]) => void) => () => void
    onNoteDataChanged: (callback: () => void) => () => void

    // Week View Widget
    weekViewWidgetCreate: () => Promise<void>
    weekViewWidgetClose: () => void
    weekViewWidgetIsOpen: () => Promise<boolean>
    weekViewWidgetMove: (x: number, y: number) => void
    weekViewWidgetResize: (width: number, height: number) => void
    weekViewWidgetGetState: () => Promise<any>

    // Card Window (Floating)
    cardCreate: (options: any) => Promise<string>
    cardClose: (id: string) => void
    cardSetOpacity: (id: string, opacity: number) => void
    cardSetAlwaysOnTop: (id: string, alwaysOnTop: boolean) => void
    cardToggleMode: (id: string, mode: 'floating' | 'desktop') => void
    cardFocus: (id: string) => void
    cardBlur: (id: string) => void
    cardGetAll: () => Promise<string[]>
    cardMove: (id: string, deltaX: number, deltaY: number) => void
    cardResize: (id: string, width: number, height: number) => void
    cardDesktopAvailable: () => Promise<boolean>
    cardGetMode: (id: string) => Promise<string>
    resetCardPositions: () => Promise<boolean>

    // System / Data
    getAutoStart: () => Promise<boolean>
    setAutoStart: (enabled: boolean) => Promise<boolean>
    getWallpapers: () => Promise<string[]>
    saveWallpaper: (path: string) => Promise<string>
    selectDirectory: () => Promise<string | null>
    exportData: () => Promise<boolean>
    importData: () => Promise<boolean>

    // Notes management
    getAllNotes: () => Promise<any[]>
    createNote: (note: any) => Promise<any>
    updateNote: (note: any) => Promise<any>
    deleteNote: (id: string) => Promise<boolean>
    noteWindowCreate: (options: any) => Promise<boolean>
    noteWindowClose: (id: string) => void
    noteShowContextMenu: (options: any) => void
    onNoteMenuAction: (callback: (data: any) => void) => () => void
    noteWindowMove: (id: string, deltaX: number, deltaY: number) => void
    noteWindowDragStart: (id: string) => void
    noteWindowDragEnd: (id: string) => void

    // Auto Update
    checkForUpdates: () => Promise<{ status: string; result?: any; message?: string }>
    downloadUpdate: () => Promise<{ status: string; message?: string }>
    installUpdate: () => void
    getAppVersion: () => Promise<string>
    onUpdateStatus: (callback: (data: { status: string; version?: string; percent?: number; message?: string }) => void) => () => void
    getUpdateUrl: () => Promise<string>
    setUpdateUrl: (url: string) => Promise<{ status: string; message?: string }>

    // Capsule (闪念胶囊)
    capsuleShow: () => Promise<boolean>
    capsuleHide: () => Promise<boolean>
    capsuleToggle: () => Promise<boolean>
    capsuleSetHeight: (height: number) => Promise<boolean>
    capsuleParse: (text: string) => Promise<{ result: any; source: 'local' | 'cloud' | 'none'; hasContent: boolean }>
    capsuleCreateTask: (task: any) => Promise<{ success: boolean; task?: any; error?: string }>
    onCapsuleFocusInput: (callback: () => void) => () => void
    onCapsuleReset: (callback: () => void) => () => void

    // AI Provider Management
    capsuleGetProviders: () => Promise<{ success: boolean; providers: AIProviderConfig[]; error?: string }>
    capsuleGetProvider: (id: string) => Promise<{ success: boolean; provider?: AIProviderConfig; error?: string }>
    capsuleSaveProvider: (provider: AIProviderConfig) => Promise<{ success: boolean; provider?: AIProviderConfig; error?: string }>
    capsuleDeleteProvider: (id: string) => Promise<{ success: boolean; error?: string }>
    capsuleTestProvider: (provider: AIProviderConfig) => Promise<{ success: boolean; message: string }>
    capsuleSetActiveProvider: (id: string) => Promise<{ success: boolean; error?: string }>
    capsuleGetSettings: () => Promise<{ success: boolean; settings?: CapsuleSettings; error?: string }>
    capsuleSaveSettings: (settings: Partial<CapsuleSettings>) => Promise<{ success: boolean; error?: string }>
    capsuleGetDefaultPrompt: () => Promise<{ success: boolean; prompt: string }>


    // Avatar operations
    selectAvatarFile: () => Promise<{ path: string; previewUrl: string }>
    saveAvatar: (sourcePath: string) => Promise<string>
    removeAvatar: () => Promise<void>
    getAvatarPath: () => Promise<string>
    getAvatarList: () => Promise<{ url: string; name: string }[]>
    deleteAvatarHistoryItem: (filename: string) => Promise<boolean>
    selectAvatar: (dataUrl: string) => Promise<boolean>

    // Excel import operations
    excelSelectFile: () => Promise<string | null>
    excelParse: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
    excelImport: (tasks: any[], newPanels: any[]) => Promise<{ success: boolean; data?: any; error?: string }>
    excelDownloadTemplate: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>

    // App Info
    getAppIconPath: () => Promise<string>
}

// AI Provider Config Type
interface AIProviderConfig {
    id: string
    type: 'gemini' | 'openai_compatible'
    name: string
    enabled: boolean
    baseUrl: string
    apiKey?: string
    modelName: string
    systemPrompt?: string
    temperature: number
    maxTokens: number
    isDefault: boolean
}

// Capsule Settings Type
interface CapsuleSettings {
    useAI: boolean
    activeProviderId: string
    systemPrompt: string
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
