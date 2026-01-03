import { Notification, app } from 'electron'
import { getAllTasks, updateTask, getAllSubtasks, updateSubtask } from './database'

// 检查间隔 (60秒)
const CHECK_INTERVAL = 60 * 1000

let checkInterval: NodeJS.Timeout | null = null

/**
 * 检查并发送到期提醒
 * 使用数据库中的 reminder_sent 字段来持久化记录已发送的提醒
 */
async function checkReminders(): Promise<void> {
    try {
        const tasks = await getAllTasks()
        const now = new Date()

        for (const task of tasks) {
            // 跳过已完成的任务
            if (task.status === 'done') continue

            // 跳过已发送过提醒的任务
            if (task.reminder_sent) continue

            // 只检查开启了提醒的任务
            if (task.reminder_enabled && task.reminder_date != null && task.reminder_hour != null && task.reminder_minute != null) {
                // 构建提醒时间
                const [year, month, day] = task.reminder_date.split('-').map(Number)
                const reminderTime = new Date(year, month - 1, day, task.reminder_hour, task.reminder_minute, 0)

                // 如果提醒时间已过
                if (reminderTime <= now) {
                    const timeStr = `${String(task.reminder_hour).padStart(2, '0')}:${String(task.reminder_minute).padStart(2, '0')}`
                    sendNotification(task.title, `任务提醒时间到了！(${task.reminder_date} ${timeStr})`)

                    // 标记为已发送，持久化到数据库
                    try {
                        await updateTask({
                            ...task,
                            reminder_sent: 1,
                            updated_at: new Date().toISOString()
                        })
                    } catch (err) {
                        console.error('Failed to update reminder_sent:', err)
                    }
                }
            }
        }

        // 检查子任务提醒
        await checkSubtaskReminders(now)
    } catch (error) {
        console.error('Failed to check reminders:', error)
    }
}

/**
 * 检查子任务提醒
 */
async function checkSubtaskReminders(now: Date): Promise<void> {
    try {
        const allSubtasks = await getAllSubtasks()
        const allTasks = await getAllTasks()

        // 创建一个 Map 来快速查找父任务状态
        const taskStatusMap = new Map<string, string>()
        for (const task of allTasks) {
            taskStatusMap.set(task.id, task.status)
        }

        for (const subtask of allSubtasks) {
            // 跳过已完成的子任务
            if (subtask.completed) continue

            // 跳过已发送过提醒的子任务
            if (subtask.reminder_sent) continue

            // 跳过父任务已完成的子任务
            const parentStatus = taskStatusMap.get(subtask.task_id)
            if (parentStatus === 'done') continue

            // 只检查开启了提醒的子任务
            if (subtask.reminder_enabled && subtask.reminder_date != null && subtask.reminder_hour != null && subtask.reminder_minute != null) {
                // 构建提醒时间
                const [year, month, day] = subtask.reminder_date.split('-').map(Number)
                const reminderTime = new Date(year, month - 1, day, subtask.reminder_hour, subtask.reminder_minute, 0)

                // 如果提醒时间已过
                if (reminderTime <= now) {
                    const timeStr = `${String(subtask.reminder_hour).padStart(2, '0')}:${String(subtask.reminder_minute).padStart(2, '0')}`
                    sendNotification(`子任务: ${subtask.title}`, `子任务提醒时间到了！(${subtask.reminder_date} ${timeStr})`)

                    // 标记为已发送
                    try {
                        await updateSubtask({
                            ...subtask,
                            reminder_sent: 1
                        })
                    } catch (err) {
                        console.error('Failed to update subtask reminder_sent:', err)
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to check subtask reminders:', error)
    }
}

/**
 * 发送系统通知 (导出以便外部调用，如周期任务生成时立即提醒)
 */
export function sendNotification(title: string, body: string): void {
    if (!Notification.isSupported()) {
        return
    }

    const notification = new Notification({
        title: `井然 - ${title}`,
        body,
        icon: undefined,
        silent: false
    })

    notification.on('click', () => {
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            const mainWindow = windows[0]
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    notification.show()
}

/**
 * 初始化提醒系统
 */
export function initReminderSystem(): void {
    // 初次检查
    checkReminders()

    // 定期检查
    checkInterval = setInterval(checkReminders, CHECK_INTERVAL)
}

/**
 * 停止提醒系统
 */
export function stopReminderSystem(): void {
    if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
    }
}
