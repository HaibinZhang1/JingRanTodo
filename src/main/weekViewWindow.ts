import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { getSettings, setSetting } from './database'

let weekViewWindow: BrowserWindow | null = null
const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged

interface WeekViewWidgetState {
    bounds?: Electron.Rectangle
    opacity?: number
}

// 获取保存的状态
function getSavedState(): WeekViewWidgetState {
    const settings = getSettings()
    return settings.weekViewWidget || {}
}

// 保存状态
function saveState(state: Partial<WeekViewWidgetState>) {
    const settings = getSettings()
    const currentState = settings.weekViewWidget || {}
    setSetting('weekViewWidget', { ...currentState, ...state })
}

export function createWeekViewWidget() {
    if (weekViewWindow && !weekViewWindow.isDestroyed()) {
        weekViewWindow.show()
        weekViewWindow.focus()
        return
    }

    const savedState = getSavedState()
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    // 默认位置：屏幕右侧
    const defaultWidth = 360
    const defaultHeight = 500
    const defaultX = screenWidth - defaultWidth - 20
    const defaultY = 100

    const bounds = savedState.bounds || {
        width: defaultWidth,
        height: defaultHeight,
        x: defaultX,
        y: defaultY
    }

    weekViewWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        frame: false,
        transparent: true,
        resizable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        minWidth: 300,
        minHeight: 200,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    })

    const url = isDev
        ? `http://localhost:5173/#/week-view-widget`
        : `file://${join(__dirname, '../../dist/index.html')}#/week-view-widget`

    weekViewWindow.loadURL(url)

    // 窗口移动/调整大小时保存状态
    const handleBoundsChange = () => {
        if (weekViewWindow && !weekViewWindow.isDestroyed()) {
            saveState({ bounds: weekViewWindow.getBounds() })
        }
    }

    weekViewWindow.on('moved', handleBoundsChange)
    weekViewWindow.on('resized', handleBoundsChange)

    weekViewWindow.on('closed', () => {
        weekViewWindow = null
    })
}

export function closeWeekViewWidget() {
    if (weekViewWindow && !weekViewWindow.isDestroyed()) {
        weekViewWindow.close()
    }
}

export function setupWeekViewWidgetIPC() {
    ipcMain.handle('weekview-widget-create', () => {
        createWeekViewWidget()
    })

    ipcMain.on('weekview-widget-close', () => {
        closeWeekViewWidget()
    })

    ipcMain.handle('weekview-widget-is-open', () => {
        return !!weekViewWindow && !weekViewWindow.isDestroyed()
    })

    // 窗口拖动
    ipcMain.on('weekview-widget-move', (event, x: number, y: number) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) {
            win.setPosition(x, y)
        }
    })

    // 窗口调整
    ipcMain.on('weekview-widget-resize', (event, w: number, h: number) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) {
            win.setSize(w, h)
        }
    })

    ipcMain.handle('weekview-widget-get-state', () => {
        return getSavedState()
    })
}

export function restoreWeekViewWidget() {
    // 检查是否自动恢复？
    // const savedState = getSavedState()
    // if (savedState.isOpen) { ... }
    // 目前暂不自动恢复，由用户点击
}
