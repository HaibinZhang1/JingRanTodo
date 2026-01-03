import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import App from './App'
import NoteInputView from './views/NoteInputView'
import NoteFloatingView from './views/NoteFloatingView'
import DesktopWidget from './components/DesktopWidget'
import { ErrorBoundary } from './components/ErrorBoundary'

import CapsuleView from './views/CapsuleView'
// import WeekViewWidget from './views/WeekViewWidget'

import { I18nProvider } from './i18n'
import './styles/globals.css'
const isCardWindow = window.location.hash.startsWith('#/card')
// 检测是否是笔记窗口 (URL 包含 #/note-input)
const isNoteInputWindow = window.location.hash.startsWith('#/note-input')
// 检测是否是笔记窗口 (URL 包含 #/note)
const isNoteWindow = window.location.hash.startsWith('#/note') && !isNoteInputWindow

// 检测是否是胶囊窗口 (URL 包含 #/capsule)
const isCapsuleWindow = window.location.hash.startsWith('#/capsule')

// 检测是否是周视图悬浮窗 (URL 包含 #/weekview-widget)
// const isWeekViewWidget = window.location.hash.startsWith('#/weekview-widget')


// 获取卡片 ID
const getCardId = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    return params.get('id') || 'default-card'
}

// 获取初始透明度
const getInitialOpacity = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const opacity = params.get('opacity')
    return opacity ? parseInt(opacity) : 80
}

// 获取窗口标题
const getTitle = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const title = params.get('title')
    return title ? decodeURIComponent(title) : "任务卡片"
}

// 卡片窗口关闭处理
const handleCardClose = () => {
    const cardId = getCardId()
    window.electronAPI?.cardClose?.(cardId)
}



ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Provider store={store}>
            <I18nProvider>
                <ErrorBoundary>
                    {isCardWindow ? (
                        <DesktopWidget
                            cardId={getCardId()}
                            initialOpacity={getInitialOpacity()}
                            title={getTitle()}
                            onClose={handleCardClose}
                        />
                    ) : isNoteInputWindow ? (
                        <NoteInputView />
                    ) : isNoteWindow ? (
                        <NoteFloatingView />
                    ) : isCapsuleWindow ? (
                        <CapsuleView />
                    ) : (

                        <App />
                    )}
                </ErrorBoundary>
            </I18nProvider>
        </Provider>
    </React.StrictMode>
)

// Global Type Definitions for Build
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
    cardSetResizable: (id: string, resizable: boolean) => void
    cardDesktopAvailable: () => Promise<boolean>
    cardGetMode: (id: string) => Promise<string>
    resetCardPositions: () => Promise<boolean>

    // Week View Widget
    weekViewWidgetCreate: () => Promise<void>
    weekViewWidgetClose: () => void
    weekViewWidgetIsOpen: () => Promise<boolean>
    weekViewWidgetMove: (x: number, y: number) => void
    weekViewWidgetResize: (width: number, height: number) => void
    weekViewWidgetGetState: () => Promise<any>

    // System / Data
    getAutoStart: () => Promise<boolean>
    setAutoStart: (enabled: boolean) => Promise<boolean>
    getWallpapers: () => Promise<string[]>
    saveWallpaper: (path: string) => Promise<string>
    selectDirectory: () => Promise<string | null>
    exportData: () => Promise<boolean>
    importData: () => Promise<boolean>

    // Notes
    getAllNotes: () => Promise<any[]>
    createNote: (note: any) => Promise<any>
    updateNote: (note: any) => Promise<any>
    deleteNote: (id: string) => Promise<boolean>
    noteWindowCreate: (options: any) => Promise<void>
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
    capsuleGetProviders: () => Promise<{ success: boolean; providers: any[]; error?: string }>
    capsuleGetProvider: (id: string) => Promise<{ success: boolean; provider?: any; error?: string }>
    capsuleSaveProvider: (provider: any) => Promise<{ success: boolean; provider?: any; error?: string }>
    capsuleDeleteProvider: (id: string) => Promise<{ success: boolean; error?: string }>
    capsuleTestProvider: (provider: any) => Promise<{ success: boolean; message: string }>
    capsuleSetActiveProvider: (id: string) => Promise<{ success: boolean; error?: string }>
    capsuleGetSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>
    capsuleSaveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
    capsuleGetDefaultPrompt: () => Promise<{ success: boolean; prompt: string }>

    // Excel import operations
    excelSelectFile: () => Promise<string | null>
    excelParse: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
    excelImport: (tasks: any[], newPanels: any[]) => Promise<{ success: boolean; data?: any; error?: string }>
    excelDownloadTemplate: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
