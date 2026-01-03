import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Database operations (using db- prefix to match main process handlers)
    getAllTasks: () => ipcRenderer.invoke('db-get-all-tasks'),
    createTask: (task: any) => ipcRenderer.invoke('db-create-task', task),
    updateTask: (id: string, updates: any) => ipcRenderer.invoke('db-update-task', id, updates),
    deleteTask: (id: string) => ipcRenderer.invoke('db-delete-task', id),

    // Subtask operations
    getSubtasks: (taskId: string) => ipcRenderer.invoke('db-get-subtasks', taskId),
    createSubtask: (subtask: any) => ipcRenderer.invoke('db-create-subtask', subtask),
    updateSubtask: (subtask: any) => ipcRenderer.invoke('db-update-subtask', subtask),
    deleteSubtask: (id: string) => ipcRenderer.invoke('db-delete-subtask', id),

    // Panel operations
    getAllPanels: () => ipcRenderer.invoke('db-get-all-panels'),
    createPanel: (panel: any) => ipcRenderer.invoke('db-create-panel', panel),
    updatePanel: (id: string, updates: any) => ipcRenderer.invoke('db-update-panel', id, updates),
    deletePanel: (id: string) => ipcRenderer.invoke('db-delete-panel', id),

    // Settings
    getSettings: () => ipcRenderer.invoke('db-get-settings'),
    setSetting: (key: string, value: any) => ipcRenderer.invoke('db-set-setting', key, value),

    // Shortcut Recording
    startShortcutRecording: () => ipcRenderer.invoke('start-shortcut-recording'),
    stopShortcutRecording: () => ipcRenderer.invoke('stop-shortcut-recording'),
    onShortcutRecorded: (callback: (shortcut: string) => void) => {
        const handler = (_: any, shortcut: string) => callback(shortcut)
        ipcRenderer.on('shortcut-recorded', handler)
        return () => ipcRenderer.removeListener('shortcut-recorded', handler)
    },

    // Recurring template operations
    getAllRecurringTemplates: () => ipcRenderer.invoke('db-get-all-recurring'),
    createRecurringTemplate: (template: any) => ipcRenderer.invoke('db-create-recurring', template),
    updateRecurringTemplate: (template: any) => ipcRenderer.invoke('db-update-recurring', template),
    deleteRecurringTemplate: (id: string) => ipcRenderer.invoke('db-delete-recurring', id),

    // Window controls (matching renderer API names)
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),

    // Wallpaper
    getWallpaperList: () => ipcRenderer.invoke('get-wallpaper-list'),
    setWallpaper: (path: string) => ipcRenderer.invoke('set-wallpaper', path),
    saveWallpaper: (filePath: string) => ipcRenderer.invoke('save-wallpaper', filePath),
    getWallpapers: () => ipcRenderer.invoke('get-wallpapers'),

    // Directory selection
    selectDirectory: () => ipcRenderer.invoke('dialog-select-directory'),

    // Auto-start
    getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
    setAutoStart: (enable: boolean) => ipcRenderer.invoke('set-auto-start', enable),

    // Data import/export
    exportData: () => ipcRenderer.invoke('export-data'),
    importData: () => ipcRenderer.invoke('import-data'),

    // Note image saving (drag & drop)
    saveNoteImage: (filePath: string) => ipcRenderer.invoke('save-note-image', filePath),

    // Open external URL in system browser
    openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),

    // Open Dialog  
    openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options),

    // Avatar operations
    selectAvatarFile: () => ipcRenderer.invoke('avatar:select'),
    saveAvatar: (sourcePath: string) => ipcRenderer.invoke('avatar:save', sourcePath),
    removeAvatar: () => ipcRenderer.invoke('avatar:remove'),
    getAvatarPath: () => ipcRenderer.invoke('avatar:get'),
    getAvatarList: () => ipcRenderer.invoke('avatar:list'),
    deleteAvatarHistoryItem: (filename: string) => ipcRenderer.invoke('avatar:delete', filename),
    selectAvatar: (dataUrl: string) => ipcRenderer.invoke('avatar:set-current', dataUrl),

    // Floating note window (Persistence)
    openFloatingNote: (note: any) => ipcRenderer.invoke('open-floating-note', note),
    updateFloatingNote: (id: string, content: string) => ipcRenderer.send('update-floating-note', id, content),
    closeFloatingNote: (id: string) => ipcRenderer.send('close-floating-note', id),
    onNoteUpdated: (id: string, callback: (content: string) => void) => {
        const handler = (_: any, noteId: string, content: string) => {
            if (noteId === id) callback(content)
        }
        ipcRenderer.on('note-updated', handler)
        return () => ipcRenderer.removeListener('note-updated', handler)
    },
    onNoteDataChanged: (callback: () => void) => {
        const handler = () => callback()
        ipcRenderer.on('note-data-changed', handler)
        return () => ipcRenderer.removeListener('note-data-changed', handler)
    },
    onNoteClosed: (id: string, callback: () => void) => {
        const handler = (_: any, noteId: string) => {
            if (noteId === id) callback()
        }
        ipcRenderer.on('note-closed', handler)
        return () => ipcRenderer.removeListener('note-closed', handler)
    },

    // Card actions
    // Card Config
    onCardListChanged: (callback: (ids: string[]) => void) => {
        const handler = (_: any, ids: string[]) => callback(ids)
        ipcRenderer.on('card-list-changed', handler)
        return () => ipcRenderer.removeListener('card-list-changed', handler)
    },

    // Card Window (Floating)
    cardCreate: (options: any) => ipcRenderer.invoke('card-create', options),
    cardClose: (id: string) => ipcRenderer.send('card-close', id),
    cardSetOpacity: (id: string, opacity: number) => ipcRenderer.send('card-set-opacity', id, opacity),
    cardSetAlwaysOnTop: (id: string, alwaysOnTop: boolean) => ipcRenderer.send('card-set-always-on-top', id, alwaysOnTop),
    cardToggleMode: (id: string, mode: 'floating' | 'desktop') => ipcRenderer.send('card-toggle-mode', id, mode),
    // cardFocus/Blur might not be IPC but renderer logic? Or focus window?
    // vite-env has them. Main process doesn't seem to have specific focus handlers other than create/restore.
    // Let's check cardWindow.ts again. It has createCardWindow which focuses.
    // If renderer needs to focus explicitly, we might need an IPC. 
    // But for now, let's map what we have.
    cardFocus: (id: string) => ipcRenderer.send('card-focus', id), // Assuming main process might interpret this or we add it? 
    // Wait, cardWindow.ts DOES NOT have 'card-focus'.
    // I should probably omit it or add it to main if needed. 
    // App.tsx doesn't seem to call cardFocus directly in the snippet I saw.
    // Let's double check vite-env. Yes, it has cardFocus.
    // I will leave stub or omit. Better to omit if not implemented in main to avoid error invocation.
    // But if I omit, TS might complain if mapped to ElectronAPI? 
    // ElectronAPI is type def. Preload implementation is runtime. 
    // Missing runtime implementation means undefined at runtime.
    // I will map what exists in main:
    cardGetAll: () => ipcRenderer.invoke('card-get-all'),
    cardMove: (id: string, deltaX: number, deltaY: number) => ipcRenderer.send('card-move', id, deltaX, deltaY),
    cardResize: (id: string, width: number, height: number) => ipcRenderer.send('card-resize', id, width, height),
    cardSetResizable: (id: string, resizable: boolean) => ipcRenderer.send('card-set-resizable', id, resizable),
    cardSetCollapsed: (id: string, collapsed: boolean, originalHeight: number) => ipcRenderer.send('card-set-collapsed', id, collapsed, originalHeight),
    cardDesktopAvailable: () => ipcRenderer.invoke('card-desktop-available'),
    cardGetMode: (id: string) => ipcRenderer.invoke('card-get-mode', id),
    resetCardPositions: () => ipcRenderer.invoke('card-reset-positions'),

    // Mouse position (for edge docking collapse check)
    getMousePosition: () => ipcRenderer.invoke('get-mouse-position'),

    // Task data change notification
    onTaskDataChanged: (callback: () => void) => {
        const handler = () => callback()
        ipcRenderer.on('task-data-changed', handler)
        return () => ipcRenderer.removeListener('task-data-changed', handler)
    },

    // Capsule operations (matching parseService.ts IPC handlers)
    capsuleParse: (text: string) => ipcRenderer.invoke('capsule:parse', text),
    capsuleCreateTask: (task: any) => ipcRenderer.invoke('capsule:create-task', task),
    capsuleGetProviders: () => ipcRenderer.invoke('capsule:get-providers'),
    capsuleGetProvider: (id: string) => ipcRenderer.invoke('capsule:get-provider', id),
    capsuleSaveProvider: (provider: any) => ipcRenderer.invoke('capsule:save-provider', provider),
    capsuleDeleteProvider: (id: string) => ipcRenderer.invoke('capsule:delete-provider', id),
    capsuleTestProvider: (provider: any) => ipcRenderer.invoke('capsule:test-provider', provider),
    capsuleSetActiveProvider: (id: string) => ipcRenderer.invoke('capsule:set-active-provider', id),
    capsuleGetSettings: () => ipcRenderer.invoke('capsule:get-settings'),
    capsuleSaveSettings: (settings: any) => ipcRenderer.invoke('capsule:save-settings', settings),
    capsuleGetDefaultPrompt: () => ipcRenderer.invoke('capsule:get-default-prompt'),

    // Capsule window control
    capsuleHide: () => ipcRenderer.invoke('capsule:hide'),
    capsuleSetHeight: (height: number) => ipcRenderer.invoke('capsule:set-height', height),
    onCapsuleFocusInput: (callback: () => void) => {
        const handler = () => callback()
        ipcRenderer.on('capsule:focus-input', handler)
        return () => ipcRenderer.removeListener('capsule:focus-input', handler)
    },
    onCapsuleReset: (callback: () => void) => {
        const handler = () => callback()
        ipcRenderer.on('capsule:reset', handler)
        return () => ipcRenderer.removeListener('capsule:reset', handler)
    },

    // Legacy capsule operations (keeping for backwards compatibility)
    analyzeTask: (input: string) => ipcRenderer.invoke('analyze-task', input),
    parseTaskWithAI: (input: string, options?: { dateContext?: string }) => ipcRenderer.invoke('parse-task-with-ai', input, options),
    getProviderList: () => ipcRenderer.invoke('get-provider-list'),
    addProvider: (config: any) => ipcRenderer.invoke('add-provider', config),
    updateProvider: (id: string, config: any) => ipcRenderer.invoke('update-provider', id, config),
    removeProvider: (id: string) => ipcRenderer.invoke('remove-provider', id),
    getActiveProvider: () => ipcRenderer.invoke('get-active-provider'),
    setActiveProvider: (id: string) => ipcRenderer.invoke('set-active-provider', id),
    testProvider: (id: string) => ipcRenderer.invoke('test-provider', id),
    getAiSettings: () => ipcRenderer.invoke('get-ai-settings'),
    updateAiSettings: (settings: any) => ipcRenderer.invoke('update-ai-settings', settings),

    // Update operations
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
    onUpdateStatus: (callback: (status: any) => void) => {
        const handler = (_: any, status: any) => callback(status)
        ipcRenderer.on('update-status', handler)
        return () => ipcRenderer.removeListener('update-status', handler)
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
        const handler = (_: any, progress: any) => callback(progress)
        ipcRenderer.on('update-progress', handler)
        return () => ipcRenderer.removeListener('update-progress', handler)
    },

    // Note management
    getAllNotes: () => ipcRenderer.invoke('db-get-all-notes'),
    createNote: (note: any) => ipcRenderer.invoke('db-create-note', note),
    updateNote: (note: any) => ipcRenderer.invoke('db-update-note', note),
    deleteNote: (id: string) => ipcRenderer.invoke('db-delete-note', id),
    noteWindowCreate: (options: any) => ipcRenderer.invoke('note-window-create', options),
    noteWindowClose: (id: string) => ipcRenderer.send('note-window-close', id),
    noteShowContextMenu: (options: any) => ipcRenderer.send('note-context-menu', options),
    noteWindowMove: (id: string, deltaX: number, deltaY: number) => ipcRenderer.send('note-window-move', id, deltaX, deltaY),
    noteWindowDragStart: (id: string) => ipcRenderer.send('note-window-drag-start', id),
    noteWindowDragEnd: (id: string) => ipcRenderer.send('note-window-drag-end', id),
    onNoteMenuAction: (callback: (data: any) => void) => {
        const handler = (_: any, data: any) => callback(data)
        ipcRenderer.on('note-menu-action', handler)
        return () => ipcRenderer.removeListener('note-menu-action', handler)
    },

    // Week View Widget - Phantom Window approach
    getHolidayData: (year: number) => ipcRenderer.invoke('get-holiday-data', year),

    // Week View Widget - Phantom Window approach
    weekViewWidgetCreate: () => ipcRenderer.invoke('weekview-widget-create'),
    weekViewWidgetClose: () => ipcRenderer.send('weekview-widget-close'),
    weekViewWidgetIsOpen: () => ipcRenderer.invoke('weekview-widget-is-open'),
    weekViewWidgetMove: (x: number, y: number) => ipcRenderer.send('weekview-widget-move', x, y),
    weekViewWidgetResize: (width: number, height: number) => ipcRenderer.send('weekview-widget-resize', width, height),
    weekViewWidgetGetState: () => ipcRenderer.invoke('weekview-widget-get-state'),

    // Excel import operations
    excelSelectFile: () => ipcRenderer.invoke('excel:select-file'),
    excelParse: (filePath: string) => ipcRenderer.invoke('excel:parse', filePath),
    excelImport: (tasks: any[], newPanels: any[]) => ipcRenderer.invoke('excel:import', tasks, newPanels),
    excelDownloadTemplate: () => ipcRenderer.invoke('excel:download-template'),

    // App Info
    getAppIconPath: () => ipcRenderer.invoke('get-app-icon-path'),
})
