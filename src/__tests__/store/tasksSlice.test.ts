import { configureStore } from '@reduxjs/toolkit'
import tasksReducer, {
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    toggleTaskPin,
    Task,
} from '../../renderer/store/tasksSlice'

// 创建测试任务的辅助函数
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-1',
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

describe('tasksSlice', () => {
    const createTestStore = () =>
        configureStore({
            reducer: { tasks: tasksReducer },
        })

    describe('reducers', () => {
        it('moveTask should update task status', () => {
            const store = createTestStore()
            // 先添加一个任务到 store
            store.dispatch({
                type: 'tasks/create/fulfilled',
                payload: createMockTask({ id: 'test-1', status: 'todo' }),
            })

            store.dispatch(moveTask({ taskId: 'test-1', newStatus: 'done' }))
            const state = store.getState()
            expect(state.tasks.items[0].status).toBe('done')
        })

        it('moveTask should update updated_at timestamp', () => {
            const store = createTestStore()
            const originalTask = createMockTask({ id: 'test-1' })
            store.dispatch({
                type: 'tasks/create/fulfilled',
                payload: originalTask,
            })

            const beforeMove = store.getState().tasks.items[0].updated_at

            // 等待一小段时间确保时间戳不同
            store.dispatch(moveTask({ taskId: 'test-1', newStatus: 'done' }))
            const afterMove = store.getState().tasks.items[0].updated_at

            expect(afterMove).not.toBe(beforeMove)
        })

        it('toggleTaskPin should toggle is_pinned', () => {
            const store = createTestStore()
            store.dispatch({
                type: 'tasks/create/fulfilled',
                payload: createMockTask({ id: 'test-1', is_pinned: false }),
            })

            store.dispatch(toggleTaskPin('test-1'))
            expect(store.getState().tasks.items[0].is_pinned).toBe(true)

            store.dispatch(toggleTaskPin('test-1'))
            expect(store.getState().tasks.items[0].is_pinned).toBe(false)
        })

        it('toggleTaskPin should do nothing for non-existent task', () => {
            const store = createTestStore()
            store.dispatch({
                type: 'tasks/create/fulfilled',
                payload: createMockTask({ id: 'test-1' }),
            })

            const before = store.getState().tasks.items[0]
            store.dispatch(toggleTaskPin('non-existent'))
            const after = store.getState().tasks.items[0]

            expect(before.is_pinned).toBe(after.is_pinned)
        })
    })

    describe('async thunks', () => {
        it('createTask should add task to state', async () => {
            const store = createTestStore()
            await store.dispatch(
                createTask({
                    title: '新任务',
                    priority: 'high',
                })
            )
            const state = store.getState()
            expect(state.tasks.items.length).toBe(1)
            expect(state.tasks.items[0].title).toBe('新任务')
            expect(state.tasks.items[0].priority).toBe('high')
        })

        it('createTask should set default values', async () => {
            const store = createTestStore()
            await store.dispatch(
                createTask({
                    title: '默认任务',
                })
            )
            const task = store.getState().tasks.items[0]
            expect(task.status).toBe('todo')
            expect(task.priority).toBe('medium')
            expect(task.is_pinned).toBe(false)
            expect(task.is_recurring).toBe(false)
        })

        it('deleteTask should remove task from state', async () => {
            const store = createTestStore()
            await store.dispatch(createTask({ title: '待删除' }))
            const taskId = store.getState().tasks.items[0].id

            await store.dispatch(deleteTask(taskId))
            expect(store.getState().tasks.items.length).toBe(0)
        })

        it('updateTask should update task in state', async () => {
            const store = createTestStore()
            await store.dispatch(createTask({ title: '原标题' }))
            const task = store.getState().tasks.items[0]

            await store.dispatch(
                updateTask({
                    ...task,
                    title: '新标题',
                })
            )
            expect(store.getState().tasks.items[0].title).toBe('新标题')
        })
    })

    describe('extra reducers - loading states', () => {
        it('fetchTasks.pending should set loading to true', () => {
            const store = createTestStore()
            store.dispatch({ type: 'tasks/fetchAll/pending' })
            expect(store.getState().tasks.loading).toBe(true)
            expect(store.getState().tasks.error).toBe(null)
        })

        it('fetchTasks.fulfilled should set loading to false and update items', () => {
            const store = createTestStore()
            const mockTasks = [createMockTask({ id: '1' }), createMockTask({ id: '2' })]
            store.dispatch({ type: 'tasks/fetchAll/fulfilled', payload: mockTasks })
            expect(store.getState().tasks.loading).toBe(false)
            expect(store.getState().tasks.items.length).toBe(2)
        })

        it('fetchTasks.rejected should set error', () => {
            const store = createTestStore()
            store.dispatch({
                type: 'tasks/fetchAll/rejected',
                error: { message: '获取任务失败' },
            })
            expect(store.getState().tasks.loading).toBe(false)
            expect(store.getState().tasks.error).toBe('获取任务失败')
        })
    })
})
