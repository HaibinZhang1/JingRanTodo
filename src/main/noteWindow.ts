import { BrowserWindow, screen, ipcMain, app, Menu } from 'electron'
import { join } from 'path'
import { updateNote, getAllNotes } from './notes'

// 存储笔记窗口实例 Map<NoteID, BrowserWindow>
let noteWindows: Map<string, BrowserWindow> = new Map()

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

interface NoteWindowOptions {
    id: string
    x?: number
    y?: number
    width?: number
    height?: number
    zIndex?: number
}

/**
 * 创建或激活悬浮笔记窗口
 */
export async function createNoteWindow(options: NoteWindowOptions): Promise<BrowserWindow> {
    const { id, x, y, width, height, zIndex } = options

    const existingWindow = noteWindows.get(id)
    if (existingWindow) {
        if (existingWindow.isMinimized()) existingWindow.restore()
        existingWindow.show()
        existingWindow.focus()
        return existingWindow
    }

    // 获取屏幕尺寸，作为默认位置参考
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const defaultX = screenWidth / 2 - 160
    const defaultY = screenHeight / 2 - 200

    const win = new BrowserWindow({
        width: width || 280,
        height: height || 320,
        x: x ?? defaultX,
        y: y ?? defaultY,
        minWidth: 180,
        minHeight: 120,
        frame: false,
        transparent: true,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
        show: false
    })

    // 加载页面
    const url = isDev
        ? `http://localhost:5173/#/note?id=${id}`
        : `file://${join(__dirname, '../../dist/index.html')}#/note?id=${id}`

    win.loadURL(url)

    win.once('ready-to-show', () => {
        win.show()
    })

    // 监听调整大小完成，保存尺寸
    win.on('resized', () => {
        const [w, h] = win.getSize()
        updateNote({
            id,
            width: w,
            height: h
        }).catch(err => console.error('Failed to auto-save note size:', err))
    })

    win.on('closed', () => {
        noteWindows.delete(id)
        updateNote({ id, isFloating: false }).catch(err => console.error('Failed to update note status:', err))
    })

    noteWindows.set(id, win)
    return win
}

export function closeNoteWindow(id: string) {
    const win = noteWindows.get(id)
    if (win) {
        win.close()
    }
}

export function closeAllNoteWindows() {
    noteWindows.forEach(win => win.close())
    noteWindows.clear()
}

// 启动时恢复浮动笔记窗口
export async function restoreSavedNotes() {
    const { getAllNotes } = await import('./notes')
    const notes = await getAllNotes()

    const floatingNotes = notes.filter(note => note.isFloating)

    for (const note of floatingNotes) {
        try {
            await createNoteWindow({
                id: note.id,
                x: note.position?.x,
                y: note.position?.y,
                width: note.width,
                height: note.height,
                zIndex: note.zIndex
            })
        } catch (error) {
            console.error(`[Main] Failed to restore note window ${note.id}:`, error)
        }
    }
}

// 供 Main Index 调用
export function setupNoteWindowIPC() {
    ipcMain.handle('note-window-create', async (_, options: NoteWindowOptions) => {
        try {
            await createNoteWindow(options)
            return true
        } catch (error) {
            console.error('[Main] Failed to create note window:', error)
            throw error
        }
    })

    ipcMain.on('note-window-close', (_, id: string) => {
        closeNoteWindow(id)
    })

    // 存储拖动开始时的窗口初始位置和 Content 尺寸
    const dragState: Map<string, {
        startX: number
        startY: number
        contentWidth: number
        contentHeight: number
    }> = new Map()

    // 接收偏移量（相对于拖动开始时的鼠标位置），计算绝对位置
    ipcMain.on('note-window-move', (_, id: string, offsetX: number, offsetY: number) => {
        const win = noteWindows.get(id)
        const state = dragState.get(id)
        if (win && state) {
            // 绝对位置 = 初始窗口位置 + 鼠标偏移量
            const newX = Math.round(state.startX + offsetX)
            const newY = Math.round(state.startY + offsetY)

            win.setPosition(newX, newY)

            // 修正尺寸
            win.setContentSize(state.contentWidth, state.contentHeight)
        }
    })

    // 拖动开始时保存初始窗口位置和 Content 尺寸
    ipcMain.on('note-window-drag-start', (_, id: string) => {
        const win = noteWindows.get(id)
        if (win) {
            const [startX, startY] = win.getPosition()
            const [contentWidth, contentHeight] = win.getContentSize()
            dragState.set(id, { startX, startY, contentWidth, contentHeight })
            win.setResizable(false)
        }
    })

    // 拖动结束时清除状态并恢复 resize
    ipcMain.on('note-window-drag-end', (_, id: string) => {
        const win = noteWindows.get(id)
        const state = dragState.get(id)
        if (win && state) {
            win.setContentSize(state.contentWidth, state.contentHeight)
        }
        dragState.delete(id)
        if (win) win.setResizable(true)
    })

    ipcMain.on('note-window-resize', (_, id: string, width: number, height: number) => {
        const win = noteWindows.get(id)
        if (win) win.setSize(width, height)
    })

    // 原生右键菜单
    ipcMain.on('note-context-menu', (event, options: {
        id: string,
        mode: 'edit' | 'split' | 'preview',
        fontSize: number,
        opacity: number,
        fontFamily: string,
        showHeader: boolean
    }) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return

        // 获取模式显示文本
        const getModeLabel = () => {
            switch (options.mode) {
                case 'edit': return '编辑'
                case 'split': return '拆分'
                case 'preview': return '预览'
            }
        }

        const template: Electron.MenuItemConstructorOptions[] = [
            {
                label: `🔄 切换模式 (当前: ${getModeLabel()})`,
                click: () => event.sender.send('note-menu-action', { action: 'toggleMode' })
            },
            { type: 'separator' },
            {
                label: options.showHeader ? '📌 隐藏标题栏' : '📌 显示标题栏',
                click: () => event.sender.send('note-menu-action', { action: 'toggleHeader' })
            },
            { type: 'separator' },
            {
                label: '字号',
                submenu: [
                    { label: `当前: ${options.fontSize}`, enabled: false },
                    { type: 'separator' },
                    { label: '增大 (+)', click: () => event.sender.send('note-menu-action', { action: 'fontSizeUp' }) },
                    { label: '减小 (-)', click: () => event.sender.send('note-menu-action', { action: 'fontSizeDown' }) }
                ]
            },
            {
                label: '字体',
                submenu: [
                    { label: '系统默认', type: 'radio', checked: options.fontFamily.includes('system'), click: () => event.sender.send('note-menu-action', { action: 'setFont', value: 'system-ui, sans-serif' }) },
                    { label: '等宽字体', type: 'radio', checked: options.fontFamily === 'monospace', click: () => event.sender.send('note-menu-action', { action: 'setFont', value: 'monospace' }) },
                    { label: '微软雅黑', type: 'radio', checked: options.fontFamily.includes('YaHei'), click: () => event.sender.send('note-menu-action', { action: 'setFont', value: '"Microsoft YaHei", sans-serif' }) }
                ]
            },
            {
                label: `透明度: ${options.opacity}%`,
                submenu: [
                    { label: '100%', click: () => event.sender.send('note-menu-action', { action: 'setOpacity', value: 100 }) },
                    { label: '85%', click: () => event.sender.send('note-menu-action', { action: 'setOpacity', value: 85 }) },
                    { label: '70%', click: () => event.sender.send('note-menu-action', { action: 'setOpacity', value: 70 }) },
                    { label: '50%', click: () => event.sender.send('note-menu-action', { action: 'setOpacity', value: 50 }) }
                ]
            },
            { type: 'separator' },
            {
                label: '❌ 关闭 (Esc)',
                click: () => closeNoteWindow(options.id)
            }
        ]

        const menu = Menu.buildFromTemplate(template)
        menu.popup({ window: win })
    })
}
