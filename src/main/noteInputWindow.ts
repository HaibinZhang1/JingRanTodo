/**
 * 笔记标题输入窗口管理
 * 用于快捷键创建笔记时输入标题
 */

import { BrowserWindow, screen } from 'electron'
import path from 'path'

let noteInputWindow: BrowserWindow | null = null

/**
 * 显示笔记标题输入窗口
 */
export function showNoteInputWindow(): void {
    // 如果窗口已存在且未销毁，直接显示
    if (noteInputWindow && !noteInputWindow.isDestroyed()) {
        noteInputWindow.show()
        noteInputWindow.focus()
        return
    }

    // 获取屏幕中心位置
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const windowWidth = 450
    const windowHeight = 250

    noteInputWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: Math.floor((screenWidth - windowWidth) / 2),
        y: Math.floor(screenHeight / 3),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        show: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
        noteInputWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/note-input`)
    } else {
        noteInputWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
            hash: '/note-input'
        })
    }

    // 窗口关闭时清理引用
    noteInputWindow.on('closed', () => {
        noteInputWindow = null
    })

    noteInputWindow.once('ready-to-show', () => {
        noteInputWindow?.show()
        noteInputWindow?.focus()
    })
}

export function closeNoteInputWindow() {
    if (noteInputWindow && !noteInputWindow.isDestroyed()) {
        noteInputWindow.close()
    }
}
