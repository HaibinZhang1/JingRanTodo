import { getAllTasks, createTask, updateTask } from './database'
import { addDays, addWeeks, addMonths } from 'date-fns'
import { randomUUID } from 'crypto'

interface Task {
    id: string
    title: string
    description?: string
    status: 'todo' | 'done'
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    is_recurring: boolean
    recurrence_rule?: string
    [key: string]: any
}

/**
 * 处理周期任务完成后创建下一个任务
 */
export async function handleRecurringTaskCompletion(task: Task): Promise<void> {
    if (!task.is_recurring || !task.recurrence_rule || !task.due_date) {
        return
    }

    const currentDueDate = new Date(task.due_date)
    let nextDueDate: Date

    // 根据周期规则计算下一个日期
    if (task.recurrence_rule.startsWith('custom|')) {
        const [, intervalStr, unit] = task.recurrence_rule.split('|')
        const interval = parseInt(intervalStr, 10) || 1

        switch (unit) {
            case 'daily':
                nextDueDate = addDays(currentDueDate, interval)
                break
            case 'weekly':
                nextDueDate = addWeeks(currentDueDate, interval)
                break
            case 'monthly':
                nextDueDate = addMonths(currentDueDate, interval)
                break
            case 'yearly':
                // 需要确保引入 addYears，如果 date-fns 没有导出需要检查，通常有
                const { addYears } = require('date-fns')
                nextDueDate = addYears(currentDueDate, interval)
                break
            default:
                nextDueDate = addDays(currentDueDate, interval)
        }
    } else {
        switch (task.recurrence_rule) {
            case 'daily':
                nextDueDate = addDays(currentDueDate, 1)
                break
            case 'weekly':
                nextDueDate = addWeeks(currentDueDate, 1)
                break
            case 'monthly':
                nextDueDate = addMonths(currentDueDate, 1)
                break
            case 'yearly':
                const { addYears } = require('date-fns')
                nextDueDate = addYears(currentDueDate, 1)
                break
            default:
                // 默认每天
                nextDueDate = addDays(currentDueDate, 1)
        }
    }

    // Format to YYYY-MM-DD (Local)
    const year = nextDueDate.getFullYear()
    const month = String(nextDueDate.getMonth() + 1).padStart(2, '0')
    const day = String(nextDueDate.getDate()).padStart(2, '0')
    const nextDueDateStr = `${year}-${month}-${day}`
    const nowIso = new Date().toISOString()

    // 创建下一个周期任务 (字段完整版)
    const newTask = {
        id: randomUUID(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'todo' as const,
        // 日期字段
        start_date: nextDueDateStr, // 开始日期等于截止日期
        due_date: nextDueDateStr,
        completed_at: null,
        // 周期任务字段
        is_recurring: 1, // 使用数字格式与数据库一致
        recurrence_rule: task.recurrence_rule,
        parent_id: null, // 独立任务，不设置 parent_id 避免与持续任务混淆
        // 提醒字段
        reminder_time: task.reminder_time || null,
        reminder_enabled: task.reminder_enabled ? 1 : 0,
        reminder_date: task.reminder_date || null,
        reminder_hour: task.reminder_hour ?? null,
        reminder_minute: task.reminder_minute ?? null,
        reminder_sent: 0, // 新任务未发送提醒
        // 其他字段
        panel_id: task.panel_id || null,
        is_pinned: 0, // 使用数字格式与数据库一致
        auto_generate_daily: 0, // 周期任务不自动生成每日实例
        rank: '',
        created_at: nowIso,
        updated_at: nowIso
    }

    try {
        await createTask(newTask as any)
        console.log(`Created next recurring task for: ${task.title}, due: ${newTask.due_date}`)
    } catch (error) {
        console.error('Failed to create recurring task:', error)
    }
}

/**
 * 检查并处理所有刚完成的周期任务
 * 改进：不再依赖未持久化的 _recurring_processed 字段，
 * 而是通过检查是否已存在下一个周期任务来避免重复创建
 */
export async function processRecurringTasks(): Promise<void> {
    try {
        const tasks = await getAllTasks()

        for (const task of tasks) {
            // 查找标记为完成的周期任务
            if (task.status === 'done' && task.is_recurring && task.recurrence_rule && task.due_date) {
                // 计算下一个任务的截止日期
                const currentDueDate = new Date(task.due_date)
                let nextDueDate: Date

                if (task.recurrence_rule.startsWith('custom|')) {
                    const [, intervalStr, unit] = task.recurrence_rule.split('|')
                    const interval = parseInt(intervalStr, 10) || 1
                    switch (unit) {
                        case 'daily': nextDueDate = addDays(currentDueDate, interval); break
                        case 'weekly': nextDueDate = addWeeks(currentDueDate, interval); break
                        case 'monthly': nextDueDate = addMonths(currentDueDate, interval); break
                        default: nextDueDate = addDays(currentDueDate, interval)
                    }
                } else {
                    switch (task.recurrence_rule) {
                        case 'daily': nextDueDate = addDays(currentDueDate, 1); break
                        case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break
                        case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break
                        default: nextDueDate = addDays(currentDueDate, 1)
                    }
                }

                const year = nextDueDate.getFullYear()
                const month = String(nextDueDate.getMonth() + 1).padStart(2, '0')
                const day = String(nextDueDate.getDate()).padStart(2, '0')
                const nextDueDateStr = `${year}-${month}-${day}`

                // 检查是否已存在相同标题和截止日期的任务（防止重复生成）
                const existingNext = tasks.find(t =>
                    t.title === task.title &&
                    t.due_date?.split('T')[0] === nextDueDateStr &&
                    t.is_recurring &&
                    t.status === 'todo'
                )

                if (!existingNext) {
                    await handleRecurringTaskCompletion(task)
                    console.log(`[Recurrence] Created next task for "${task.title}" due: ${nextDueDateStr}`)
                } else {
                    console.log(`[Recurrence] Task "${task.title}" already has next instance, skipping`)
                }
            }
        }
    } catch (error) {
        console.error('Failed to process recurring tasks:', error)
    }
}

