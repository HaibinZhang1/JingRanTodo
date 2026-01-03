import { describe, it, expect, beforeEach, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import tasksReducer, { createTask, Task } from '../../renderer/store/tasksSlice'
import settingsReducer from '../../renderer/store/settingsSlice'

// 创建测试任务的辅助函数
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: '测试任务',
    description: '',
    status: 'todo',
    priority: 'medium',
    is_pinned: false,
    start_date: null,
    due_date: null,
    completed_at: null,
    panel_id: null,
    rank: '2026-01-01T00:00:00.000Z',
    is_recurring: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    subtasks: [],
    ...overrides,
})

// 创建测试 Store
const createTestStore = (preloadedState = {}) => {
    return configureStore({
        reducer: {
            tasks: tasksReducer,
            settings: settingsReducer,
        },
        preloadedState,
    })
}

describe('Task Panel Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('任务面板过滤', () => {
        it('should filter tasks by panel_id', () => {
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', title: '面板A任务', panel_id: 'panel-a' }),
                        createMockTask({ id: '2', title: '面板B任务', panel_id: 'panel-b' }),
                        createMockTask({ id: '3', title: '无面板任务', panel_id: null }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const panelATasks = store
                .getState()
                .tasks.items.filter((t) => t.panel_id === 'panel-a')
            expect(panelATasks.length).toBe(1)
            expect(panelATasks[0].title).toBe('面板A任务')
        })

        it('should filter tasks without panel_id', () => {
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', panel_id: 'panel-a' }),
                        createMockTask({ id: '2', panel_id: null }),
                        createMockTask({ id: '3', panel_id: null }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const noPanelTasks = store
                .getState()
                .tasks.items.filter((t) => t.panel_id === null)
            expect(noPanelTasks.length).toBe(2)
        })
    })

    describe('任务状态筛选', () => {
        it('should filter todo tasks', () => {
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', status: 'todo' }),
                        createMockTask({ id: '2', status: 'done' }),
                        createMockTask({ id: '3', status: 'todo' }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const todoTasks = store
                .getState()
                .tasks.items.filter((t) => t.status === 'todo')
            expect(todoTasks.length).toBe(2)
        })

        it('should filter completed tasks', () => {
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', status: 'todo' }),
                        createMockTask({ id: '2', status: 'done' }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const doneTasks = store
                .getState()
                .tasks.items.filter((t) => t.status === 'done')
            expect(doneTasks.length).toBe(1)
        })
    })

    describe('任务日期筛选', () => {
        it('should filter tasks by due_date', () => {
            const today = '2026-01-02'
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', due_date: today }),
                        createMockTask({ id: '2', due_date: '2026-01-03' }),
                        createMockTask({ id: '3', due_date: today }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const todayTasks = store
                .getState()
                .tasks.items.filter((t) => t.due_date === today)
            expect(todayTasks.length).toBe(2)
        })

        it('should filter overdue tasks', () => {
            const today = new Date('2026-01-05')
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', due_date: '2026-01-01', status: 'todo' }),
                        createMockTask({ id: '2', due_date: '2026-01-10', status: 'todo' }),
                        createMockTask({ id: '3', due_date: '2026-01-03', status: 'done' }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const overdueTasks = store.getState().tasks.items.filter((t) => {
                if (!t.due_date || t.status === 'done') return false
                return new Date(t.due_date) < today
            })
            expect(overdueTasks.length).toBe(1)
            expect(overdueTasks[0].id).toBe('1')
        })
    })

    describe('任务优先级筛选', () => {
        it('should filter high priority tasks', () => {
            const store = createTestStore({
                tasks: {
                    items: [
                        createMockTask({ id: '1', priority: 'high' }),
                        createMockTask({ id: '2', priority: 'medium' }),
                        createMockTask({ id: '3', priority: 'very-high' }),
                    ],
                    loading: false,
                    error: null,
                },
            })

            const highPriorityTasks = store
                .getState()
                .tasks.items.filter((t) => t.priority === 'high' || t.priority === 'very-high')
            expect(highPriorityTasks.length).toBe(2)
        })
    })

    describe('Store 与组件交互', () => {
        it('should create task and add to store', async () => {
            const store = createTestStore()

            await store.dispatch(
                createTask({
                    title: '新建任务',
                    priority: 'high',
                    panel_id: 'test-panel',
                })
            )

            const state = store.getState()
            expect(state.tasks.items.length).toBe(1)
            expect(state.tasks.items[0].title).toBe('新建任务')
            expect(state.tasks.items[0].panel_id).toBe('test-panel')
        })
    })
})
