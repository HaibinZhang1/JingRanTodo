/**
 * 胶囊解析服务入口
 * 统一的解析 API，处理 IPC 请求
 */

import { ipcMain, Notification, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { parseLocally, ParsedTask, hasParseResult } from './localParser'
import { parseWithFallback, testConnection, AIProviderConfig } from './aiService'
import {
    createTask,
    getAllAIProviders,
    getAIProvider,
    saveAIProvider,
    deleteAIProvider,
    setActiveAIProvider,
    getCapsuleSettings,
    saveCapsuleSettings,
    BASE_SYSTEM_PROMPT
} from '../database'

// 主窗口引用
let mainWindowRef: BrowserWindow | null = null

/**
 * 初始化解析服务
 */
export function initParseService(mainWindow: BrowserWindow): void {
    mainWindowRef = mainWindow
    registerParseIPC()
    registerProviderIPC()
    console.log('[ParseService] Initialized')
}

/**
 * 注册解析相关 IPC
 */
function registerParseIPC(): void {
    // 解析文本
    ipcMain.handle('capsule:parse', async (_, text: string) => {
        if (!text || !text.trim()) {
            return { result: null, source: 'none' }
        }

        try {
            const { result, source } = await parseWithFallback(text.trim())
            console.log('[ParseService] AI Result:', JSON.stringify(result, null, 2))
            return { result, source, hasContent: hasParseResult(result) }
        } catch (error) {
            console.error('[ParseService] Parse error:', error)
            // 降级到本地解析
            const result = parseLocally(text.trim())
            return { result, source: 'local', hasContent: hasParseResult(result) }
        }
    })

    // 创建任务
    ipcMain.handle('capsule:create-task', async (_, task: ParsedTask) => {
        try {
            // 构建任务对象
            const now = new Date().toISOString()
            const nowDate = new Date()
            const year = nowDate.getFullYear()
            const month = String(nowDate.getMonth() + 1).padStart(2, '0')
            const day = String(nowDate.getDate()).padStart(2, '0')
            const todayStr = `${year}-${month}-${day}`

            // 解析提醒时间为 hour 和 minute
            let reminderHour: number | null = null
            let reminderMinute: number | null = null
            if (task.reminderTime) {
                const [h, m] = task.reminderTime.split(':').map(Number)
                reminderHour = h
                reminderMinute = m
            }

            const newTask = {
                id: randomUUID(),
                title: task.title,
                description: (task as any).description || '',
                status: 'todo',
                priority: task.priority || 'medium',
                due_date: task.dueDate || todayStr, // 如果未解析出日期，默认设置为今天
                reminder_time: task.reminderTime || null,
                reminder_enabled: task.hasReminder ? 1 : 0,
                reminder_date: task.dueDate || todayStr, // 提醒日期默认与任务日期（今天）同步
                reminder_hour: reminderHour,
                reminder_minute: reminderMinute,
                tags: task.tags.length > 0 ? JSON.stringify(task.tags) : null,
                panel_id: null,
                is_pinned: 0,
                created_at: now,
                updated_at: now
            }

            // 保存到数据库
            const created = createTask(newTask)

            // 通知所有窗口刷新
            const { BrowserWindow } = await import('electron')
            const allWindows = BrowserWindow.getAllWindows()
            allWindows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('task-data-changed')
                }
            })

            return { success: true, task: created }
        } catch (error) {
            console.error('[ParseService] Create task error:', error)
            return { success: false, error: (error as Error).message }
        }
    })

    console.log('[ParseService] Parse IPC handlers registered')
}

/**
 * 注册 AI Provider 管理 IPC
 */
function registerProviderIPC(): void {
    // 获取所有 AI Providers
    ipcMain.handle('capsule:get-providers', async () => {
        try {
            return { success: true, providers: getAllAIProviders() }
        } catch (error) {
            console.error('[ParseService] Get providers error:', error)
            return { success: false, providers: [], error: (error as Error).message }
        }
    })

    // 获取单个 Provider
    ipcMain.handle('capsule:get-provider', async (_, id: string) => {
        try {
            const provider = getAIProvider(id)
            return { success: true, provider }
        } catch (error) {
            console.error('[ParseService] Get provider error:', error)
            return { success: false, provider: null, error: (error as Error).message }
        }
    })

    // 保存 Provider
    ipcMain.handle('capsule:save-provider', async (_, provider: AIProviderConfig) => {
        try {
            // 如果是新 Provider，生成 ID
            if (!provider.id) {
                provider.id = `provider-${Date.now()}`
            }
            const saved = saveAIProvider(provider)
            return { success: true, provider: saved }
        } catch (error) {
            console.error('[ParseService] Save provider error:', error)
            return { success: false, error: (error as Error).message }
        }
    })

    // 删除 Provider
    ipcMain.handle('capsule:delete-provider', async (_, id: string) => {
        try {
            deleteAIProvider(id)
            return { success: true }
        } catch (error) {
            console.error('[ParseService] Delete provider error:', error)
            return { success: false, error: (error as Error).message }
        }
    })

    // 测试 Provider 连接
    ipcMain.handle('capsule:test-provider', async (_, provider: AIProviderConfig) => {
        try {
            const result = await testConnection(provider)
            return result
        } catch (error) {
            console.error('[ParseService] Test provider error:', error)
            return { success: false, message: (error as Error).message }
        }
    })

    // 设置激活的 Provider
    ipcMain.handle('capsule:set-active-provider', async (_, id: string) => {
        try {
            setActiveAIProvider(id)
            return { success: true }
        } catch (error) {
            console.error('[ParseService] Set active provider error:', error)
            return { success: false, error: (error as Error).message }
        }
    })

    // 获取胶囊设置
    ipcMain.handle('capsule:get-settings', async () => {
        try {
            const settings = getCapsuleSettings()
            return { success: true, settings }
        } catch (error) {
            console.error('[ParseService] Get settings error:', error)
            return { success: false, settings: null, error: (error as Error).message }
        }
    })

    // 保存胶囊设置
    ipcMain.handle('capsule:save-settings', async (_, settings: { useAI?: boolean; activeProviderId?: string; systemPrompt?: string }) => {
        try {
            saveCapsuleSettings(settings)
            return { success: true }
        } catch (error) {
            console.error('[ParseService] Save settings error:', error)
            return { success: false, error: (error as Error).message }
        }
    })

    // 获取默认系统提示词（不含日期，用于UI编辑展示）
    ipcMain.handle('capsule:get-default-prompt', async () => {
        return { success: true, prompt: BASE_SYSTEM_PROMPT }
    })

    console.log('[ParseService] Provider IPC handlers registered')
}

// 重新导出类型
export type { ParsedTask } from './localParser'
