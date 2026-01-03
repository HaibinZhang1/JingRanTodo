import { sortTasks, formatTasksForCopy } from '../../renderer/utils/taskUtils'
import type { Task } from '../../renderer/store/tasksSlice'

// 创建测试任务的辅助函数
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: '测试任务',
    description: '任务描述',
    status: 'todo',
    priority: 'medium',
    is_pinned: false,
    start_date: '2026-01-01',
    due_date: '2026-01-02',
    completed_at: null,
    panel_id: null,
    rank: '2026-01-01T00:00:00.000Z',
    is_recurring: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    subtasks: [],
    ...overrides,
})

describe('sortTasks', () => {
    it('should sort done tasks after todo tasks', () => {
        const tasks = [
            createMockTask({ id: '1', status: 'done' }),
            createMockTask({ id: '2', status: 'todo' }),
        ]
        const sorted = sortTasks(tasks)
        expect(sorted[0].status).toBe('todo')
        expect(sorted[1].status).toBe('done')
    })

    it('should sort pinned tasks before unpinned tasks', () => {
        const tasks = [
            createMockTask({ id: '1', is_pinned: false }),
            createMockTask({ id: '2', is_pinned: true }),
        ]
        const sorted = sortTasks(tasks)
        expect(sorted[0].is_pinned).toBe(true)
        expect(sorted[1].is_pinned).toBe(false)
    })

    it('should sort by rank when status and pin are equal', () => {
        const tasks = [
            createMockTask({ id: '1', rank: '2026-01-02' }),
            createMockTask({ id: '2', rank: '2026-01-01' }),
        ]
        const sorted = sortTasks(tasks)
        expect(sorted[0].rank).toBe('2026-01-01')
        expect(sorted[1].rank).toBe('2026-01-02')
    })

    it('should handle empty array', () => {
        const sorted = sortTasks([])
        expect(sorted).toEqual([])
    })

    it('should not mutate original array', () => {
        const tasks = [
            createMockTask({ id: '1', status: 'done' }),
            createMockTask({ id: '2', status: 'todo' }),
        ]
        const original = [...tasks]
        sortTasks(tasks)
        expect(tasks[0].id).toBe(original[0].id)
    })
})

describe('formatTasksForCopy', () => {
    it('should return empty string for empty task list', () => {
        expect(formatTasksForCopy([], 'text')).toBe('')
    })

    it('should format tasks as JSON', () => {
        const tasks = [createMockTask({ title: '任务A', description: '描述A' })]
        const result = formatTasksForCopy(tasks, 'json')
        const parsed = JSON.parse(result)
        expect(parsed[0].title).toBe('任务A')
        expect(parsed[0].description).toBe('描述A')
    })

    it('should format tasks as Markdown', () => {
        const tasks = [createMockTask({ title: '任务A', description: '描述A' })]
        const result = formatTasksForCopy(tasks, 'markdown')
        expect(result).toContain('## 任务A')
        expect(result).toContain('描述A')
    })

    it('should include subtasks in Markdown format', () => {
        const tasks = [
            createMockTask({
                title: '主任务',
                subtasks: [
                    {
                        id: 'sub-1',
                        task_id: 'task-1',
                        title: '子任务1',
                        completed: false,
                        order: 1,
                    },
                ],
            }),
        ]
        const result = formatTasksForCopy(tasks, 'markdown')
        expect(result).toContain('子任务')
        expect(result).toContain('子任务1')
    })

    it('should use default text format with templates', () => {
        const tasks = [createMockTask({ title: '测试标题' })]
        const result = formatTasksForCopy(tasks, 'text')
        expect(result).toContain('测试标题')
    })
})
