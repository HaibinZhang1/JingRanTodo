/**
 * 自动更新模块
 * 使用 electron-updater 实现后台下载和一键安装
 */

import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { app, BrowserWindow, ipcMain } from 'electron'
import { getSettings, setSetting } from './database'

// 默认更新服务器地址
const DEFAULT_UPDATE_URL = 'http://127.0.0.1:8080/updates/'

// 检查更新超时时间（毫秒）
const CHECK_TIMEOUT = 15000

// 是否正在检查更新
let isCheckingUpdate = false

// 主窗口引用
let mainWindowRef: BrowserWindow | null = null

// 当前更新服务器地址
let currentUpdateUrl = DEFAULT_UPDATE_URL

// 超时定时器
let checkTimeoutTimer: NodeJS.Timeout | null = null

/**
 * 获取保存的更新服务器地址
 */
async function getUpdateUrl(): Promise<string> {
    try {
        const settings = await getSettings()
        return settings.updateServerUrl || DEFAULT_UPDATE_URL
    } catch {
        return DEFAULT_UPDATE_URL
    }
}

/**
 * 初始化更新器
 */
export async function initUpdater(mainWindow: BrowserWindow): Promise<void> {
    mainWindowRef = mainWindow

    // 获取保存的更新服务器地址
    currentUpdateUrl = await getUpdateUrl()

    // 配置更新服务器
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: currentUpdateUrl
    })

    // 禁用自动下载，让用户确认
    autoUpdater.autoDownload = false

    // 禁用自动安装，让用户选择时机
    autoUpdater.autoInstallOnAppQuit = true

    // 允许预发布版本（如果需要）
    autoUpdater.allowPrerelease = false

    // 日志
    autoUpdater.logger = console

    // 监听更新事件
    setupUpdateEvents()

    // 设置 IPC 处理器
    setupUpdateIPC()
}

/**
 * 清除超时定时器
 */
function clearCheckTimeout(): void {
    if (checkTimeoutTimer) {
        clearTimeout(checkTimeoutTimer)
        checkTimeoutTimer = null
    }
}

/**
 * 设置检查超时
 */
function setCheckTimeout(): void {
    clearCheckTimeout()
    checkTimeoutTimer = setTimeout(() => {
        if (isCheckingUpdate) {
            isCheckingUpdate = false
            sendUpdateStatus('error', { message: '检查更新超时，请检查网络连接或更新服务器地址' })
        }
    }, CHECK_TIMEOUT)
}

/**
 * 设置更新事件监听
 */
function setupUpdateEvents(): void {
    // 检查更新时出错
    autoUpdater.on('error', (error: Error) => {
        console.error('[Updater] Error:', error)
        clearCheckTimeout()
        isCheckingUpdate = false
        sendUpdateStatus('error', { message: error.message })
    })

    // 开始检查更新
    autoUpdater.on('checking-for-update', () => {
        isCheckingUpdate = true
        setCheckTimeout()
        sendUpdateStatus('checking')
    })

    // 有可用更新
    autoUpdater.on('update-available', (info: UpdateInfo) => {
        clearCheckTimeout()
        isCheckingUpdate = false
        sendUpdateStatus('available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        })
    })

    // 没有可用更新
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        clearCheckTimeout()
        isCheckingUpdate = false
        sendUpdateStatus('not-available', { version: info.version })
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        sendUpdateStatus('downloading', {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond
        })
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        sendUpdateStatus('downloaded', { version: info.version })
    })
}

/**
 * 设置更新相关的 IPC 处理器
 */
function setupUpdateIPC(): void {
    // 检查更新
    ipcMain.handle('check-for-updates', async () => {
        if (isCheckingUpdate) {
            return { status: 'already-checking' }
        }
        try {
            const result = await autoUpdater.checkForUpdates()
            return { status: 'ok', result }
        } catch (error) {
            clearCheckTimeout()
            isCheckingUpdate = false
            console.error('[Updater] Check for updates error:', error)
            return { status: 'error', message: (error as Error).message }
        }
    })

    // 下载更新
    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate()
            return { status: 'ok' }
        } catch (error) {
            console.error('[Updater] Download update error:', error)
            return { status: 'error', message: (error as Error).message }
        }
    })

    // 安装更新并重启
    ipcMain.on('install-update', () => {
        autoUpdater.quitAndInstall()
    })

    // 获取当前版本
    ipcMain.handle('get-app-version', () => {
        return app.getVersion()
    })

    // 获取更新服务器地址
    ipcMain.handle('get-update-url', async () => {
        return await getUpdateUrl()
    })

    // 设置更新服务器地址
    ipcMain.handle('set-update-url', async (_, url: string) => {
        try {
            // 保存到数据库
            await setSetting('updateServerUrl', url)
            // 更新当前配置
            currentUpdateUrl = url
            // 重新配置 autoUpdater
            autoUpdater.setFeedURL({
                provider: 'generic',
                url: url
            })
            return { status: 'ok' }
        } catch (error) {
            console.error('[Updater] Set update URL error:', error)
            return { status: 'error', message: (error as Error).message }
        }
    })
}

/**
 * 向渲染进程发送更新状态
 */
function sendUpdateStatus(status: string, data?: Record<string, unknown>): void {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('update-status', { status, ...data })
    }
}

/**
 * 手动检查更新
 */
export function checkForUpdates(): void {
    if (!isCheckingUpdate) {
        autoUpdater.checkForUpdates()
    }
}
