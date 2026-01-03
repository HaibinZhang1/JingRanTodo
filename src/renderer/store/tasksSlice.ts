import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'


// 类型定义
export interface Subtask {
    id: string
    task_id: string
    title: string
    description?: string
    priority?: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    completed: boolean
    order: number
    // 开始日期时间
    start_date?: string
    start_hour?: number
    start_minute?: number
    // 截止日期时间
    due_date?: string
    due_hour?: number
    due_minute?: number
    // 提醒字段
    reminder_enabled?: boolean
    reminder_date?: string
    reminder_hour?: number
    reminder_minute?: number
    reminder_sent?: boolean  // 是否已发送提醒
}

export interface Task {
    id: string
    title: string
    description?: string
    status: 'todo' | 'done'  // v2.0: 简化为 todo/done
    priority: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    is_pinned: boolean

    // 时间维度 (用于默认面板流转)
    start_date: string | null     // 开始日期 (YYYY-MM-DD)，跨天任务时与 due_date 不同
    due_date: string | null       // 截止日期 (YYYY-MM-DD)
    completed_at: string | null   // 完成时间

    // 空间维度 (用于自定义面板归属)
    panel_id: string | null       // 如果不为空，则优先显示在对应的自定义面板中

    rank: string                  // 排序权重
    reminder_time?: string        // 旧版提醒时间（向后兼容）

    // 新版提醒字段
    reminder_enabled?: boolean    // 是否开启提醒
    reminder_date?: string        // 提醒日期 (YYYY-MM-DD)
    reminder_hour?: number        // 提醒小时 (0-23)
    reminder_minute?: number      // 提醒分钟 (0-59)
    reminder_sent?: boolean       // 是否已发送提醒
    auto_generate_daily?: boolean // 持续任务是否每日自动生成待办

    is_recurring: boolean
    recurrence_rule?: string
    parent_id?: string
    created_at: string
    updated_at: string
    subtasks: Subtask[]
}

interface TasksState {
    items: Task[]
    loading: boolean
    error: string | null
}

const initialState: TasksState = {
    items: [],
    loading: false,
    error: null
}

// 异步 Thunks
export const fetchTasks = createAsyncThunk(
    'tasks/fetchAll',
    async () => {
        // 检查是否在 Electron 环境中
        if (!window.electronAPI) {
            console.log('Running in browser mode - using empty task list')
            return []
        }

        const tasks = await window.electronAPI.getAllTasks()
        // 获取每个任务的子任务
        const tasksWithSubtasks = await Promise.all(
            tasks.map(async (task: any) => {
                const subtasks = await window.electronAPI.getSubtasks(task.id)
                return {
                    ...task,
                    is_pinned: task.is_pinned === 1,
                    is_recurring: task.is_recurring === 1,
                    auto_generate_daily: task.auto_generate_daily === 1,
                    subtasks: subtasks.map((st: any) => ({
                        ...st,
                        completed: st.completed === 1,
                        reminder_enabled: st.reminder_enabled === 1
                    }))
                }
            })
        )
        return tasksWithSubtasks
    }
)

export const createTask = createAsyncThunk(
    'tasks/create',
    async (taskData: Partial<Task>) => {
        const now = new Date().toISOString()
        const effectiveDueDate = taskData.due_date || null
        const effectiveStartDate = taskData.start_date || effectiveDueDate  // start_date 默认等于 due_date
        const task = {
            id: crypto.randomUUID(),
            title: taskData.title || '',
            description: taskData.description || '',
            status: taskData.status || 'todo',
            priority: taskData.priority || 'medium',
            is_pinned: taskData.is_pinned || false,
            start_date: effectiveStartDate,
            due_date: effectiveDueDate,
            completed_at: taskData.completed_at || null,
            panel_id: taskData.panel_id || null,
            rank: taskData.rank || now,  // 使用创建时间作为初始排序权重
            reminder_time: taskData.reminder_time,
            reminder_enabled: taskData.reminder_enabled || false,
            reminder_date: taskData.reminder_date,
            reminder_hour: taskData.reminder_hour,
            reminder_minute: taskData.reminder_minute,
            auto_generate_daily: taskData.auto_generate_daily || false,
            is_recurring: taskData.is_recurring || false,
            recurrence_rule: taskData.recurrence_rule,
            parent_id: taskData.parent_id,
            created_at: taskData.created_at || now,  // 使用预设的创建时间（日历右键菜单）或当前时间
            updated_at: now
        }
        // 浏览器模式下跳过 electronAPI 调用
        if (window.electronAPI) {
            await window.electronAPI.createTask(task)
        }
        return { ...task, subtasks: [] } as Task
    }
)

export const updateTask = createAsyncThunk(
    'tasks/update',
    async (task: Task) => {
        const updatedTask = {
            ...task,
            updated_at: new Date().toISOString()
        }
        if (window.electronAPI) {
            await window.electronAPI.updateTask(updatedTask)
        }
        return updatedTask
    }
)

export const deleteTask = createAsyncThunk(
    'tasks/delete',
    async (id: string) => {
        if (window.electronAPI) {
            await window.electronAPI.deleteTask(id)
        }
        return id
    }
)

export const createSubtask = createAsyncThunk(
    'tasks/createSubtask',
    async ({ taskId, title, description, priority, start_date, start_hour, start_minute, due_date, due_hour, due_minute, reminder_enabled, reminder_date, reminder_hour, reminder_minute }: {
        taskId: string;
        title: string;
        description?: string;
        priority?: Subtask['priority'];
        start_date?: string;
        start_hour?: number;
        start_minute?: number;
        due_date?: string;
        due_hour?: number;
        due_minute?: number;
        reminder_enabled?: boolean;
        reminder_date?: string;
        reminder_hour?: number;
        reminder_minute?: number;
    }) => {
        const subtask = {
            id: crypto.randomUUID(),
            task_id: taskId,
            title,
            description,
            priority: priority || 'low',
            completed: false,
            order: Date.now(),
            start_date,
            start_hour,
            start_minute,
            due_date,
            due_hour,
            due_minute,
            reminder_enabled: reminder_enabled || false,
            reminder_date,
            reminder_hour,
            reminder_minute
        }
        if (window.electronAPI) {
            await window.electronAPI.createSubtask(subtask)
        }
        return subtask
    }
)

export const updateSubtask = createAsyncThunk(
    'tasks/updateSubtask',
    async (subtask: Subtask) => {
        if (window.electronAPI) {
            await window.electronAPI.updateSubtask(subtask)
        }
        return subtask
    }
)

export const deleteSubtask = createAsyncThunk(
    'tasks/deleteSubtask',
    async ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) => {
        if (window.electronAPI) {
            await window.electronAPI.deleteSubtask(subtaskId)
        }
        return { taskId, subtaskId }
    }
)

// Slice
const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        // 本地更新任务状态（用于拖拽等即时反馈）
        moveTask: (state, action: PayloadAction<{ taskId: string; newStatus: Task['status'] }>) => {
            const task = state.items.find(t => t.id === action.payload.taskId)
            if (task) {
                task.status = action.payload.newStatus
                task.updated_at = new Date().toISOString()
            }
        },
        toggleTaskPin: (state, action: PayloadAction<string>) => {
            const task = state.items.find(t => t.id === action.payload)
            if (task) {
                task.is_pinned = !task.is_pinned
            }
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchTasks
            .addCase(fetchTasks.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchTasks.fulfilled, (state, action) => {
                state.loading = false
                state.items = action.payload
            })
            .addCase(fetchTasks.rejected, (state, action) => {
                state.loading = false
                state.error = action.error.message || 'Failed to fetch tasks'
            })
            // createTask
            .addCase(createTask.fulfilled, (state, action) => {
                state.items.unshift(action.payload)
            })
            // updateTask
            .addCase(updateTask.fulfilled, (state, action) => {
                const index = state.items.findIndex(t => t.id === action.payload.id)
                if (index !== -1) {
                    state.items[index] = action.payload
                }
            })
            // deleteTask
            .addCase(deleteTask.fulfilled, (state, action) => {
                state.items = state.items.filter(t => t.id !== action.payload)
            })
            // createSubtask
            .addCase(createSubtask.fulfilled, (state, action) => {
                const task = state.items.find(t => t.id === action.payload.task_id)
                if (task) {
                    task.subtasks.push(action.payload)
                }
            })
            // updateSubtask
            .addCase(updateSubtask.fulfilled, (state, action) => {
                const task = state.items.find(t => t.id === action.payload.task_id)
                if (task) {
                    const index = task.subtasks.findIndex(st => st.id === action.payload.id)
                    if (index !== -1) {
                        task.subtasks[index] = action.payload
                    }
                }
            })
            // deleteSubtask
            .addCase(deleteSubtask.fulfilled, (state, action) => {
                const task = state.items.find(t => t.id === action.payload.taskId)
                if (task) {
                    task.subtasks = task.subtasks.filter(st => st.id !== action.payload.subtaskId)
                }
            })
    }
})

export const { moveTask, toggleTaskPin } = tasksSlice.actions
export default tasksSlice.reducer


