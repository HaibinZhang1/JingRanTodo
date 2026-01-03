import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, protocol, net, shell } from 'electron'
import { join, basename, normalize } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'fs'
import { checkAndMigrateData } from './migration'
import {
    initDatabase,
    getAllTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    getSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    getSettings,
    setSetting,
    getAllPanels,
    createPanel,
    updatePanel,
    deletePanel,
    getAllRecurringTemplates,
    createRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
    checkAndGenerateRecurringTasks,
    checkAndGenerateContinuousTasks,
    closeDatabase
} from './database'
import { setupCardWindowIPC, restoreSavedCards, closeAllCardWindows } from './cardWindow'
import { setupWeekViewWidgetIPC, restoreWeekViewWidget, closeWeekViewWidget } from './weekViewWindow'

import { cleanupAllIntervals } from './desktopAttach'


import { registerShortcuts, unregisterShortcuts, getShortcutStatus } from './shortcuts'
import { createTray } from './tray'
import { initBackupSystem } from './backup'
import { initReminderSystem, stopReminderSystem } from './reminder'
import { initUpdater } from './updater'
import { initCapsule } from './capsuleWindow'
import { initParseService } from './capsule/parseService'
import { registerExcelHandlers } from './excel/importHandler'

// Helper to find icon path (same logic as tray.ts)
function getAppIconPath() {
    const paths = [
        join(process.resourcesPath, 'public/icon.png'), // Priority: packaged public
        join(process.resourcesPath, 'icon.png'),
        join(__dirname, '../../public/icon.png'), // Dev
        join(app.getAppPath(), 'public/icon.png')
    ]

    for (const p of paths) {
        if (existsSync(p)) return p
    }
    return ''
}

ipcMain.handle('get-app-icon-path', () => {
    return getAppIconPath()
})

// 保持对窗口和托盘的引用，避免被垃圾回收
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 是否是开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function broadcastTaskUpdate() {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('task-data-changed')
    })
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: isDev
            ? join(__dirname, '../../public/icon.png')
            : join(process.resourcesPath, 'public/icon.png'),
        frame: false, // 无边框窗口，自定义标题栏
        transparent: true, // 开启透明支持
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
        show: false, // 先隐藏，等加载完成后显示
        // backgroundColor: '#f0f0f0' // 移除默认背景色以支持透明
    })

    // 窗口准备好后显示，避免白屏闪烁
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    // 加载页面
    if (isDev) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
        mainWindow.loadURL(devUrl)
        // DevTools 默认打开，也可以通过 F12 或 Ctrl+Shift+I 切换
        mainWindow.webContents.openDevTools({ mode: 'detach' })

        // 注册 F12 快捷键来切换 DevTools
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                mainWindow?.webContents.toggleDevTools()
                event.preventDefault()
            }
        })
    } else {
        mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
    }

    // 窗口关闭时最小化到托盘而非退出
    // 窗口关闭时最小化到托盘而非退出
    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
        }
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // 注册快捷键
    if (mainWindow) {
        // Initial registration with default or loaded settings
        try {
            const settings = getSettings()
            const shortcuts = settings.shortcuts || {
                toggleMainWindow: 'Ctrl+Shift+Z',
                toggleCapsule: 'Alt+Space',
                createStickyNote: 'Ctrl+Alt+N'
            }
            registerShortcuts(mainWindow, shortcuts as any)
        } catch (err) {
            console.error('[Shortcuts] Failed to load settings:', err)
            // Fallback to defaults
            registerShortcuts(mainWindow, {
                toggleMainWindow: 'Ctrl+Shift+Z',
                toggleCapsule: 'Alt+Space',
                createStickyNote: 'Ctrl+Alt+N'
            })
        }
    }
}

app.on('before-quit', () => {
    (app as any).isQuitting = true
})

// 注册特权协议，必须在 app ready 之前调用
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'safe-file',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
            bypassCSP: true
        }
    }
])

// 设置 IPC 处理器
function setupIPC() {
    // 窗口控制
    ipcMain.on('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        win?.minimize()
    })

    ipcMain.on('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win?.isMaximized()) {
            win.unmaximize()
        } else {
            win?.maximize()
        }
    })

    ipcMain.on('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win && mainWindow && win.webContents.id === mainWindow.webContents.id) {
            win.hide()
        } else {
            win?.close()
        }
    })

    // 数据库操作 - Tasks
    ipcMain.handle('db-get-all-tasks', async () => {
        return getAllTasks()
    })

    ipcMain.handle('db-get-task', async (_, id: string) => {
        return getTask(id)
    })

    ipcMain.handle('db-create-task', async (_, task: any) => {
        const result = await createTask(task)
        broadcastTaskUpdate()
        return result
    })

    ipcMain.handle('db-update-task', async (_, task: any) => {
        const result = await updateTask(task)

        // 如果任务被标记为完成且是周期任务，创建下一个任务
        if (task.status === 'done' && task.is_recurring && task.recurrence_rule && task.due_date) {
            const { handleRecurringTaskCompletion } = await import('./recurrence')
            await handleRecurringTaskCompletion(task)
        }

        broadcastTaskUpdate()
        return result
    })

    ipcMain.handle('db-delete-task', async (_, id: string) => {
        const result = await deleteTask(id)
        broadcastTaskUpdate()
        return result
    })

    // 子任务操作
    ipcMain.handle('db-get-subtasks', async (_, taskId: string) => {
        return getSubtasks(taskId)
    })

    ipcMain.handle('db-create-subtask', async (_, subtask: any) => {
        const result = await createSubtask(subtask)
        broadcastTaskUpdate()
        return result
    })

    ipcMain.handle('db-update-subtask', async (_, subtask: any) => {
        const result = await updateSubtask(subtask)
        broadcastTaskUpdate()
        return result
    })

    ipcMain.handle('db-delete-subtask', async (_, id: string) => {
        const result = await deleteSubtask(id)
        broadcastTaskUpdate()
        return result
    })

    // 设置操作
    ipcMain.handle('db-get-settings', async () => {
        return getSettings()
    })

    ipcMain.handle('db-set-setting', async (_, key: string, value: any) => {
        const result = await setSetting(key, value)

        // If shortcuts changed, re-register
        if (key === 'shortcuts') {
            if (mainWindow) {
                registerShortcuts(mainWindow, value)
            }
        }

        return result
    })

    // Shortcut Recording Trap
    ipcMain.handle('start-shortcut-recording', () => {
        // Unregister all shortcuts to prevent conflicts and trap system keys
        globalShortcut.unregisterAll()

        // Trap specific system keys that we want to record but OS/Electron might swallow
        // For Alt+Space specifically
        try {
            globalShortcut.register('Alt+Space', () => {
                mainWindow?.webContents.send('shortcut-recorded', 'Alt+Space')
            })
        } catch (e) {
            console.error('Failed to trap Alt+Space', e)
        }
    })

    ipcMain.handle('stop-shortcut-recording', () => {
        // Restore normal shortcuts
        globalShortcut.unregisterAll()
        const settings = getSettings()
        const shortcuts = settings.shortcuts || {
            toggleMainWindow: 'Ctrl+Shift+Z',
            toggleCapsule: 'Alt+Space',
            createStickyNote: 'Ctrl+Alt+N'
        }
        if (mainWindow) {
            registerShortcuts(mainWindow, shortcuts as any)
        }
    })

    // Get shortcut registration status (for debugging)
    ipcMain.handle('get-shortcut-status', () => {
        return getShortcutStatus()
    })

    // Panel operations
    ipcMain.handle('db-get-all-panels', async () => {
        return getAllPanels()
    })

    ipcMain.handle('db-create-panel', async (_, panel: any) => {
        const result = await createPanel(panel)
        // Optionally broadcast panel update if we had a separate event, 
        // but tasks might need to know if panels changed? 
        // For now, let's at least ensure redundancy if needed.
        // Actually, main window listens to 'Active cards updated' but not panel list changes via IPC event?
        // App.tsx uses unsubscribeCards = window.electronAPI?.onCardListChanged
        // But that's active cards.
        // Let's broadcast task update just to be safe, or add broadcastPanelUpdate?
        // User didn't ask for panel sync specifically, just custom panel TASKS.
        // Custom panel tasks depend on tasks. So task update is irrelevant for panel creation unless tasks are moved.
        return result
    })

    ipcMain.handle('db-update-panel', async (_, panel: any) => {
        return updatePanel(panel)
    })

    ipcMain.handle('db-delete-panel', async (_, id: string) => {
        const result = await deletePanel(id)
        // 删除面板时也会删除关联的任务，需要通知前端刷新
        broadcastTaskUpdate()
        return result
    })

    // Recurring template operations
    ipcMain.handle('db-get-all-recurring', async () => {
        return getAllRecurringTemplates()
    })

    ipcMain.handle('db-create-recurring', async (_, template: any) => {
        return createRecurringTemplate(template)
    })

    ipcMain.handle('db-update-recurring', async (_, template: any) => {
        return updateRecurringTemplate(template)
    })

    ipcMain.handle('db-delete-recurring', async (_, id: string) => {
        return deleteRecurringTemplate(id)
    })

    ipcMain.handle('db-check-recurring-tasks', async () => {
        const result = checkAndGenerateRecurringTasks()
        if (result.generated > 0) {
            broadcastTaskUpdate()
        }
        return result
    })

    // 壁纸管理 - 保存到项目的 public/images/wallpapers 目录
    ipcMain.handle('save-wallpaper', async (_, filePath: string) => {
        try {
            // 获取项目根目录下的 public/images/wallpapers 路径
            const publicDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'wallpapers')
                : join(__dirname, '..', '..', 'public', 'images', 'wallpapers')

            if (!existsSync(publicDir)) {
                mkdirSync(publicDir, { recursive: true })
            }

            const fileName = `${Date.now()}-${basename(filePath)}`
            const destPath = join(publicDir, fileName)
            copyFileSync(filePath, destPath)

            // 读取文件并返回 base64 data URL
            const ext = fileName.split('.').pop()?.toLowerCase() || 'jpeg'
            const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
            const fileBuffer = readFileSync(destPath)
            const base64 = fileBuffer.toString('base64')
            return `data:${mimeType};base64,${base64}`
        } catch (e) {
            console.error('Failed to save wallpaper:', e)
            throw e
        }
    })

    // 笔记图片保存 - 保存到 public/images/notes 目录
    ipcMain.handle('save-note-image', async (_, filePath: string) => {
        try {
            const publicDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'notes')
                : join(__dirname, '..', '..', 'public', 'images', 'notes')

            if (!existsSync(publicDir)) {
                mkdirSync(publicDir, { recursive: true })
            }

            const fileName = `${Date.now()}-${basename(filePath)}`
            const destPath = join(publicDir, fileName)
            copyFileSync(filePath, destPath)

            // 返回相对路径用于 Markdown
            return `/images/notes/${fileName}`
        } catch (e) {
            console.error('Failed to save note image:', e)
            throw e
        }
    })

    ipcMain.handle('get-wallpapers', async () => {
        try {
            const publicDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'wallpapers')
                : join(__dirname, '..', '..', 'public', 'images', 'wallpapers')

            if (!existsSync(publicDir)) return []

            const files = readdirSync(publicDir)
            // 按修改时间倒序排序并转换为 data URL
            const sortedFiles = files
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
                .map(file => {
                    const absolutePath = join(publicDir, file)
                    const ext = file.split('.').pop()?.toLowerCase() || 'jpeg'
                    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`

                    // 读取文件并转换为 base64 data URL
                    const fileBuffer = readFileSync(absolutePath)
                    const base64 = fileBuffer.toString('base64')
                    const dataUrl = `data:${mimeType};base64,${base64}`

                    return {
                        name: file,
                        dataUrl,
                        mtime: statSync(absolutePath).mtime.getTime()
                    }
                })
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, 10)

            return sortedFiles.map(f => f.dataUrl)
        } catch (e) {
            console.error('Failed to get wallpapers:', e)
            return []
        }
    })

    // Avatar operations
    ipcMain.handle('avatar:select', async () => {
        const { dialog } = require('electron')
        const result = await dialog.showOpenDialog(mainWindow!, {
            title: '选择头像',
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
            properties: ['openFile']
        })

        if (result.canceled || !result.filePaths[0]) {
            return null
        }

        const filePath = result.filePaths[0]
        // Create preview URL
        const fileBuffer = readFileSync(filePath)
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        const base64 = fileBuffer.toString('base64')
        const previewUrl = `data:${mimeType};base64,${base64}`

        return { path: filePath, previewUrl }
    })

    ipcMain.handle('avatar:save', async (_, sourcePath: string) => {
        try {
            const avatarDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'avatar')
                : join(__dirname, '..', '..', 'public', 'images', 'avatar')

            if (!existsSync(avatarDir)) {
                mkdirSync(avatarDir, { recursive: true })
            }

            // 1. Clean up old avatars if count > 10
            const files = readdirSync(avatarDir)
                .map(f => ({
                    name: f,
                    path: join(avatarDir, f),
                    mtime: statSync(join(avatarDir, f)).mtime.getTime()
                }))
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
                .sort((a, b) => b.mtime - a.mtime) // Newest first

            // Keep top 9 (so we can add 1 more = 10), delete rest
            if (files.length >= 10) {
                const filesToDelete = files.slice(9)
                filesToDelete.forEach(f => {
                    try {
                        const { unlinkSync } = require('fs')
                        unlinkSync(f.path)
                    } catch (err) {
                        console.error('Failed to delete old avatar:', f.name, err)
                    }
                })
            }

            // 2. Save new avatar with unique timestamp
            const ext = sourcePath.split('.').pop()?.toLowerCase() || 'png'
            const timestamp = Date.now()
            const avatarPath = join(avatarDir, `avatar-${timestamp}.${ext}`)

            // Copy file to avatar folder
            copyFileSync(sourcePath, avatarPath)

            // Generate data URL for display
            const fileBuffer = readFileSync(avatarPath)
            const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
            const base64 = fileBuffer.toString('base64')
            const dataUrl = `data:${mimeType};base64,${base64}`

            // Save avatar path to settings
            await setSetting('avatarPath', dataUrl)

            return dataUrl
        } catch (e) {
            console.error('Failed to save avatar:', e)
            throw e
        }
    })

    ipcMain.handle('avatar:list', async () => {
        try {
            const avatarDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'avatar')
                : join(__dirname, '..', '..', 'public', 'images', 'avatar')

            if (!existsSync(avatarDir)) return []

            const files = readdirSync(avatarDir)
                .map(f => ({
                    name: f,
                    path: join(avatarDir, f),
                    mtime: statSync(join(avatarDir, f)).mtime.getTime()
                }))
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
                .sort((a, b) => b.mtime - a.mtime) // Newest first

            return files.map(file => {
                try {
                    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
                    const buffer = readFileSync(file.path)
                    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
                    const base64 = buffer.toString('base64')
                    return {
                        url: `data:${mimeType};base64,${base64}`,
                        name: file.name
                    }
                } catch (e) {
                    console.error('Error reading avatar file:', file.name, e)
                    return null
                }
            }).filter(Boolean)
        } catch (e) {
            console.error('Failed to list avatars:', e)
            return []
        }
    })

    ipcMain.handle('avatar:delete', async (_, filename: string) => {
        try {
            const avatarDir = app.isPackaged
                ? join(process.resourcesPath, 'public', 'images', 'avatar')
                : join(__dirname, '..', '..', 'public', 'images', 'avatar')

            const filePath = join(avatarDir, filename)
            // Basic security check to prevent directory traversal
            if (!normalize(filePath).startsWith(normalize(avatarDir))) {
                throw new Error('Invalid path')
            }

            if (existsSync(filePath)) {
                const { unlinkSync } = require('fs')
                unlinkSync(filePath)
                return true
            }
            return false
        } catch (e) {
            console.error('Failed to delete avatar:', e)
            return false
        }
    })


    ipcMain.handle('avatar:set-current', async (_, dataUrl: string) => {
        try {
            await setSetting('avatarPath', dataUrl)
            return true
        } catch (e) {
            console.error('Failed to select avatar:', e)
            return false
        }
    })

    ipcMain.handle('avatar:remove', async () => {
        try {
            await setSetting('avatarPath', '')
            return true
        } catch (e) {
            console.error('Failed to remove avatar:', e)
            throw e
        }
    })

    ipcMain.handle('avatar:get', async () => {
        const settings = getSettings()
        return settings.avatarPath || null
    })

    // Export all data as JSON
    ipcMain.handle('export-data', async () => {
        const { dialog } = require('electron')

        try {
            const tasks = await getAllTasks()
            const panels = await getAllPanels()
            const settings = await getSettings()

            const data = { tasks, panels, settings, exportedAt: new Date().toISOString() }

            const result = await dialog.showSaveDialog(mainWindow!, {
                title: '导出数据',
                defaultPath: `zenhubboard-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            })

            if (!result.canceled && result.filePath) {
                writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
                return { success: true, path: result.filePath }
            }
            return { success: false }
        } catch (error) {
            console.error('Export failed:', error)
            return { success: false, error: String(error) }
        }
    })

    // Import data from JSON
    ipcMain.handle('import-data', async () => {
        const { dialog } = require('electron')

        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                title: '导入数据',
                filters: [{ name: 'JSON', extensions: ['json'] }],
                properties: ['openFile']
            })

            if (!result.canceled && result.filePaths.length > 0) {
                const content = readFileSync(result.filePaths[0], 'utf-8')
                const data = JSON.parse(content)

                // Validate data structure
                if (!data.tasks || !Array.isArray(data.tasks)) {
                    return { success: false, error: 'Invalid data format' }
                }

                // 获取现有任务
                const existingTasks = await getAllTasks()

                // 删除现有任务（清空数据）
                for (const task of existingTasks) {
                    await deleteTask(task.id)
                }

                // 获取并删除现有卡片
                const existingPanels = await getAllPanels()
                for (const panel of existingPanels) {
                    await deletePanel(panel.id)
                }

                // 导入任务
                for (const task of data.tasks) {
                    // 移除可能导致冲突的字段，让数据库生成新的
                    const taskToImport = {
                        ...task,
                        id: task.id || undefined, // 保留原ID
                    }
                    await createTask(taskToImport)
                }

                // 导入卡片
                if (data.panels && Array.isArray(data.panels)) {
                    for (const panel of data.panels) {
                        await createPanel(panel)
                    }
                }

                // 导入设置
                if (data.settings) {
                    for (const [key, value] of Object.entries(data.settings)) {
                        await setSetting(key, value)
                    }
                }

                return { success: true, imported: { tasks: data.tasks.length, panels: data.panels?.length || 0 } }
            }
            return { success: false }
        } catch (error) {
            console.error('Import failed:', error)
            return { success: false, error: String(error) }
        }
    })

    // Auto-start handlers
    ipcMain.handle('get-auto-start', async () => {
        return app.getLoginItemSettings().openAtLogin
    })

    ipcMain.handle('set-auto-start', async (_, enable: boolean) => {
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: true
        })
        return { success: true }
    })

    // Restart app
    ipcMain.handle('restart-app', async () => {
        // 停止提醒系统
        stopReminderSystem()
        // 关闭数据库
        closeDatabase()
        // 注销所有快捷键
        unregisterShortcuts()

        app.relaunch()
        app.exit(0)
    })

    // Directory selection
    ipcMain.handle('dialog-select-directory', async () => {
        const { dialog } = require('electron')
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory', 'createDirectory']
        })
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0]
        }
        return null
    })

    // 在系统浏览器中打开外部链接
    ipcMain.handle('open-external-url', async (_, url: string) => {
        try {
            // 安全检查：只允许 http/https 协议
            if (url.startsWith('http://') || url.startsWith('https://')) {
                await shell.openExternal(url)
                return { success: true }
            }
            return { success: false, error: 'Invalid URL protocol' }
        } catch (e) {
            console.error('Failed to open external URL:', e)
            return { success: false, error: String(e) }
        }
    })

} // End setupIPC

// 应用就绪时
app.whenReady().then(async () => {
    // 检查并迁移数据 (在数据库初始化之前)
    checkAndMigrateData()

    // 初始化数据库 (异步)
    await initDatabase()
    console.log('[Main] Database initialized')

    // 初始化备份系统
    initBackupSystem()

    // 初始化提醒系统
    initReminderSystem()

    // 检查并生成周期任务 (启动时检查一次)
    const runScheduler = () => {
        try {
            const result = checkAndGenerateRecurringTasks()
            if (result.generated > 0) {
                console.log(`[Main] Generated ${result.generated} recurring tasks: ${result.templates.join(', ')}`)
                broadcastTaskUpdate()
            }
        } catch (err) {
            console.error('[Main] Failed to check recurring tasks:', err)
        }

        try {
            const result = checkAndGenerateContinuousTasks()
            if (result.generated > 0) {
                console.log(`[Main] Generated ${result.generated} daily continuous tasks: ${result.tasks.join(', ')}`)
                broadcastTaskUpdate()
            }
        } catch (err) {
            console.error('[Main] Failed to check continuous tasks:', err)
        }
    }

    runScheduler()

    // 每分钟检查一次
    setInterval(runScheduler, 60 * 1000)

    // 设置 IPC 处理器
    setupIPC()

    // 设置桌面卡片 IPC 处理器
    setupCardWindowIPC()

    // 设置笔记 IPC 处理器
    setupNoteIPC()

    // 启动时清理孤立的笔记图片
    import('./notes').then(({ cleanupOrphanedNoteImages }) => {
        cleanupOrphanedNoteImages().catch(err => {
            console.error('[Main] Failed to cleanup orphaned images:', err)
        })
    })

    // 设置周视图悬浮窗 IPC 处理器
    setupWeekViewWidgetIPC()

    // 设置 Excel 导入 IPC 处理器
    registerExcelHandlers()


    // 创建主窗口
    console.log('[Main] Creating main window...')
    createMainWindow()

    // 创建系统托盘
    if (mainWindow) {
        tray = createTray(mainWindow)

        // 初始化自动更新器
        initUpdater(mainWindow)

        // 初始化闪念胶囊
        initCapsule(mainWindow)
        initParseService(mainWindow)
    }

    // 恢复保存的桌面卡片
    await restoreSavedCards()

    // 恢复浮动笔记窗口
    await restoreSavedNotes()

    // 恢复周视图悬浮窗 (延迟以确保所有 IPC handlers 已注册)
    setTimeout(() => {
        restoreWeekViewWidget()
    }, 500)

    console.log('[Main] App ready sequence completed')

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow()
        }
    })

    // 注册自定义协议 safe-file://
    protocol.handle('safe-file', (request) => {
        // 1. 获取原始 URL
        const url = request.url

        // 2. 将 safe-file:// 替换回 file://
        // 注意：Windows 上路径可能是 safe-file:///C:/... 或 safe-file://hostname/path
        // 简单替换 safe-file: 为 file:
        let fileUrl = url.replace(/^safe-file:/, 'file:')

        try {
            // 3. 解码 URL (处理空格等特殊字符)
            const decodedUrl = decodeURIComponent(fileUrl)

            // 4. Windows 路径修复
            // 如果是 file://C:/... 这种格式，URL 构造函数通常能处理，但在某些 Electron 版本可能需要 file:///
            // 我们使用 URL 对象来解析，这样更稳健

            return net.fetch(decodedUrl)
        } catch (error) {
            console.error('[Main] Protocol handler error:', error)
            console.error('[Main] Failed URL:', url)
            return new Response('Error loading file', { status: 500 })
        }
    })
})

// 应用退出前
app.on('will-quit', () => {
    // 清理桌面附着的 Z-order 定时器
    cleanupAllIntervals()
    // 关闭所有卡片窗口
    closeAllCardWindows()
    closeAllNoteWindows()
    closeWeekViewWidget()


    // 停止提醒系统
    stopReminderSystem()
    // 关闭数据库
    closeDatabase()
    // 注销所有快捷键
    unregisterShortcuts()
})

import { getAllNotes, createNote, updateNote, deleteNote } from './notes'
import { setupNoteWindowIPC, closeAllNoteWindows, restoreSavedNotes } from './noteWindow'

// Note IPC Setup
function setupNoteIPC() {
    ipcMain.handle('db-get-all-notes', async () => {
        return getAllNotes()
    })
    ipcMain.handle('db-create-note', async (_, note) => {
        return createNote(note)
    })
    ipcMain.handle('db-update-note', async (_, note) => {
        return updateNote(note)
    })
    ipcMain.handle('db-delete-note', async (_, id) => {
        return deleteNote(id)
    })

    setupNoteWindowIPC()
}


