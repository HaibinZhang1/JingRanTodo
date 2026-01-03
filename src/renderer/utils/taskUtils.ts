/**
 * 任务工具函数
 */

import type { Task } from '../store/tasksSlice'

/**
 * 任务排序
 * 规则：先按状态排序（todo在前），再按置顶状态，最后按rank排序
 */
export function sortTasks(list: Task[]): Task[] {
    return [...list].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return a.rank.localeCompare(b.rank)
    })
}

/**
 * 数字转中文序号
 */
function toChineseNum(num: number): string {
    const chars = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if (num <= 10) return chars[num]
    if (num < 20) return '十' + (num % 10 === 0 ? '' : chars[num % 10])
    return num.toString()
}

/**
 * 格式化任务列表为复制文本
 * @param tasks - 要复制的任务列表
 * @param format - 复制格式 ('text' | 'json' | 'markdown')
 * @param templateTask - 任务模板 (仅 text 格式)
 * @param templateSubtask - 子任务模板 (仅 text 格式)
 * @returns 格式化后的文本
 */
export function formatTasksForCopy(
    tasks: Task[],
    format: 'text' | 'json' | 'markdown',
    templateTask = '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}',
    templateSubtask = '    {{index}}.{{title}}\n        {{description}}'
): string {
    if (tasks.length === 0) return ''

    if (format === 'json') {
        return JSON.stringify(tasks.map(t => ({
            title: t.title,
            description: t.description,
            subtasks: t.subtasks?.map(s => ({
                title: s.title,
                description: s.description,
                completed: s.completed
            }))
        })), null, 2)
    }

    if (format === 'markdown') {
        return tasks.map(task => {
            let str = `## ${task.title}\n`
            if (task.description) str += `${task.description}\n`
            if (task.subtasks && task.subtasks.length > 0) {
                str += '\n### 子任务\n'
                task.subtasks.forEach(st => {
                    str += `- [${st.completed ? 'x' : ' '}] ${st.title}\n`
                })
            }
            return str
        }).join('\n---\n\n')
    }

    // Text format with templates
    return tasks.map((task, idx) => {
        let subtasksText = ''
        if (task.subtasks && task.subtasks.length > 0) {
            subtasksText = task.subtasks.map((st, sIdx) => {
                let stStr = templateSubtask
                    .replace(/{{index}}/g, (sIdx + 1).toString())
                    .replace(/{{title}}/g, st.title)
                    .replace(/{{description}}/g, st.description || '___EMPTY_FIELD___')
                    .replace(/{{completed}}/g, st.completed ? '[x]' : '[ ]')

                return stStr.split('\n')
                    .filter(line => line.trim() !== '___EMPTY_FIELD___')
                    .join('\n')
                    .replace(/___EMPTY_FIELD___/g, '')
            }).join('\n')
        }

        let taskStr = templateTask
            .replace(/{{chinese_index}}/g, toChineseNum(idx + 1))
            .replace(/{{index}}/g, (idx + 1).toString())
            .replace(/{{title}}/g, task.title)
            .replace(/{{description}}/g, task.description || '___EMPTY_FIELD___')
            .replace(/{{subtasks}}/g, subtasksText || '___EMPTY_FIELD___')

        taskStr = taskStr.split('\n')
            .filter(line => line.trim() !== '___EMPTY_FIELD___')
            .join('\n')
            .replace(/___EMPTY_FIELD___/g, '')

        return taskStr
    }).join('\n')
}
