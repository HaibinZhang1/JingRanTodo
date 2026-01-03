/**
 * 智能闪念胶囊窗口管理
 * 全局速记工具，支持自然语言输入和智能解析
 */

import { BrowserWindow, ipcMain, screen, app } from 'electron'
import path from 'path'

let capsuleWindow: BrowserWindow | null = null
let mainWindowRef: BrowserWindow | null = null

/**
 * 初始化胶囊模块
 */
export function initCapsule(mainWindow: BrowserWindow): void {
    mainWindowRef = mainWindow
    registerCapsuleIPC()
    console.log('[Capsule] Module initialized')
}

/**
 * 创建胶囊窗口
 */
export function createCapsuleWindow(): BrowserWindow {
    if (capsuleWindow && !capsuleWindow.isDestroyed()) {
        return capsuleWindow
    }

    // 获取屏幕中心位置
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const windowWidth = 680
    const windowHeight = 140

    capsuleWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: Math.floor((screenWidth - windowWidth) / 2),
        y: Math.floor(screenHeight / 3), // 屏幕上1/3位置
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // 加载胶囊页面
    if (process.env.VITE_DEV_SERVER_URL) {
        capsuleWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/capsule`)
    } else {
        capsuleWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
            hash: '/capsule'
        })
    }

    // 失焦时隐藏
    capsuleWindow.on('blur', () => {
        hideCapsule()
    })

    // 窗口关闭时清理引用
    capsuleWindow.on('closed', () => {
        capsuleWindow = null
    })

    console.log('[Capsule] Window created')
    return capsuleWindow
}

/**
 * 显示胶囊窗口
 */
export function showCapsule(): void {
    if (!capsuleWindow || capsuleWindow.isDestroyed()) {
        createCapsuleWindow()
    }

    if (capsuleWindow) {
        // 重新居中（多显示器支持）
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
        const [winWidth] = capsuleWindow.getSize()
        capsuleWindow.setPosition(
            Math.floor((screenWidth - winWidth) / 2),
            Math.floor(screenHeight / 3)
        )

        capsuleWindow.show()
        capsuleWindow.focus()
        // 通知渲染进程聚焦输入框
        capsuleWindow.webContents.send('capsule:focus-input')
    }
}

/**
 * 隐藏胶囊窗口
 */
export function hideCapsule(): void {
    if (capsuleWindow && !capsuleWindow.isDestroyed()) {
        capsuleWindow.hide()
        // 通知渲染进程重置状态
        capsuleWindow.webContents.send('capsule:reset')
    }
}

/**
 * 切换胶囊窗口显示/隐藏
 */
export function toggleCapsule(): void {
    if (capsuleWindow && capsuleWindow.isVisible()) {
        hideCapsule()
    } else {
        showCapsule()
    }
}

/**
 * 注册胶囊相关的 IPC 处理器
 */
function registerCapsuleIPC(): void {
    // 显示胶囊
    ipcMain.handle('capsule:show', () => {
        showCapsule()
        return true
    })

    // 隐藏胶囊
    ipcMain.handle('capsule:hide', () => {
        hideCapsule()
        return true
    })

    // 切换胶囊
    ipcMain.handle('capsule:toggle', () => {
        toggleCapsule()
        return true
    })

    // 获取胶囊窗口状态
    ipcMain.handle('capsule:is-visible', () => {
        return capsuleWindow?.isVisible() ?? false
    })

    // 调整窗口高度（Smart Chips 展开时）
    ipcMain.handle('capsule:set-height', (_, height: number) => {
        if (capsuleWindow && !capsuleWindow.isDestroyed()) {
            const [width] = capsuleWindow.getSize()
            capsuleWindow.setSize(width, Math.max(100, Math.min(300, height)))
        }
        return true
    })

    console.log('[Capsule] IPC handlers registered')
}

/**
 * 获取胶囊窗口实例
 */
export function getCapsuleWindow(): BrowserWindow | null {
    return capsuleWindow
}
