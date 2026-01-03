import { Task } from '../store/tasksSlice'
import { toChineseNum } from './formatUtils'

export interface TaskCopySettings {
    copyFormat: 'text' | 'json' | 'markdown'
    copyTemplateTask: string
    copyTemplateSubtask: string
}

export function generateTaskCopyText(tasks: Task[], settings: TaskCopySettings): string {
    const { copyFormat, copyTemplateTask, copyTemplateSubtask } = settings
    let text = ''

    if (copyFormat === 'json') {
        text = JSON.stringify(tasks.map(t => ({
            title: t.title,
            description: t.description,
            subtasks: t.subtasks?.map(s => ({ title: s.title, description: s.description, completed: s.completed }))
        })), null, 2)
    } else if (copyFormat === 'markdown') {
        text = tasks.map(task => {
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
    } else {
        text = tasks.map((task, idx) => {
            let subtasksText = ''
            if (task.subtasks && task.subtasks.length > 0) {
                subtasksText = task.subtasks.map((st, sIdx) => {
                    let stStr = (copyTemplateSubtask || '    {{index}}.{{title}}\n        {{description}}')
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

            let taskStr = (copyTemplateTask || '{{chinese_index}}、{{title}}\n{{description}}\n{{subtasks}}')
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

    return text
}
