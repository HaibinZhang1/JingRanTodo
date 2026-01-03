/**
 * Excel 导入 IPC 处理器
 */
import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseExcelFile, ParsedTask, PanelInfo } from './excelParser'
import { createTask, createSubtask, getAllPanels, createPanel } from '../database'
import { randomUUID } from 'crypto'

/**
 * 注册 Excel 相关 IPC 处理器
 */
export function registerExcelHandlers(): void {
    // 选择 Excel 文件
    ipcMain.handle('excel:select-file', async () => {
        const result = await dialog.showOpenDialog({
            title: '选择 Excel 文件',
            filters: [
                { name: 'Excel 文件', extensions: ['xlsx', 'xls'] }
            ],
            properties: ['openFile']
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        return result.filePaths[0]
    })

    // 解析 Excel 文件
    ipcMain.handle('excel:parse', async (_event, filePath: string) => {
        try {
            // 获取现有面板列表
            const panels = getAllPanels() as PanelInfo[]

            // 解析 Excel
            const result = parseExcelFile(filePath, panels)

            return {
                success: true,
                data: result
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            }
        }
    })

    // 执行导入
    ipcMain.handle('excel:import', async (_event, tasks: ParsedTask[], newPanels: { name: string; create: boolean }[]) => {
        try {
            const now = new Date().toISOString()
            let newCreatedPanelId: string | undefined

            // 获取现有面板
            const existingPanels = getAllPanels() as PanelInfo[]

            // 创建新任务卡片（如果用户选择创建）
            for (const np of newPanels) {
                if (np.create) {
                    // 检查任务卡片数量限制
                    if (existingPanels.length >= 6) {
                        return {
                            success: false,
                            error: `任务卡片数量已达上限（6个），无法创建新任务卡片 "${np.name}"`
                        }
                    }

                    const panelId = randomUUID()
                    createPanel({
                        id: panelId,
                        title: np.name,
                        isExpanded: true,
                        sort_order: existingPanels.length
                    })
                    newCreatedPanelId = panelId
                }
            }

            let createdTasks = 0
            let createdSubtasks = 0

            // 导入任务
            for (const task of tasks) {
                // 如果用户选择了新建任务卡片，所有任务都分配到新建的卡片
                // 否则使用任务本身的 panel_id
                const panelId = newCreatedPanelId || task.panel_id

                // 创建主任务
                // 如果没有截止日期，默认使用当前日期时间
                const dueDate = task.due_date || now  // now 已经是 ISO 格式的完整日期时间
                const startDate = task.start_date || dueDate

                const taskData = {
                    id: task.id,
                    title: task.title,
                    description: task.description || '',
                    status: 'todo' as const,
                    priority: task.priority,
                    is_pinned: false,
                    start_date: startDate,  // 开始日期，默认等于截止日期
                    due_date: dueDate,
                    completed_at: null,
                    panel_id: panelId || null,
                    rank: now,
                    reminder_enabled: task.reminder_enabled,
                    reminder_date: task.reminder_date,
                    reminder_hour: task.reminder_hour,
                    reminder_minute: task.reminder_minute,
                    is_recurring: false,
                    created_at: now,
                    updated_at: now
                }

                createTask(taskData)
                createdTasks++

                // 创建子任务
                for (const subtask of task.subtasks) {
                    const subtaskData = {
                        id: subtask.id,
                        task_id: task.id,
                        title: subtask.title,
                        description: subtask.description || '',
                        priority: subtask.priority,
                        completed: false,
                        order: Date.now(),
                        reminder_enabled: subtask.reminder_enabled,
                        reminder_date: subtask.reminder_date,
                        reminder_hour: subtask.reminder_hour,
                        reminder_minute: subtask.reminder_minute
                    }

                    createSubtask(subtaskData)
                    createdSubtasks++
                }
            }

            // 通知渲染进程刷新任务列表
            const windows = BrowserWindow.getAllWindows()
            windows.forEach(win => {
                win.webContents.send('task-data-changed')
            })

            return {
                success: true,
                data: {
                    createdTasks,
                    createdSubtasks
                }
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            }
        }
    })

    // 下载模板 - 从 public/task 复制预设模板
    ipcMain.handle('excel:download-template', async () => {
        try {
            // 获取模板文件路径
            const isDev = !app.isPackaged
            const templatePath = isDev
                ? join(app.getAppPath(), 'public', 'task', '任务导入模板.xlsx')
                : join(process.resourcesPath, 'public', 'task', '任务导入模板.xlsx')

            // 检查模板文件是否存在
            if (!existsSync(templatePath)) {
                return { success: false, error: '模板文件不存在' }
            }

            // 弹出保存对话框让用户选择保存位置
            const result = await dialog.showSaveDialog({
                title: '保存 Excel 模板',
                defaultPath: '任务导入模板.xlsx',
                filters: [
                    { name: 'Excel 文件', extensions: ['xlsx'] }
                ]
            })

            if (result.canceled || !result.filePath) {
                return { success: false, canceled: true }
            }

            // 复制模板文件到用户选择的位置
            copyFileSync(templatePath, result.filePath)

            return { success: true, filePath: result.filePath }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })
}
