// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import path from 'path'
import fs from 'fs'

// 1. Setup paths using vi.hoisted to survive hoisting
const mocks = vi.hoisted(() => {
    return {
        // Use a relative path to CWD, which is safe.
        // We use a simplified path to avoid ".." issues if CWD varies.
        userDataPath: 'temp_db_test_integration_final_v2'
    }
})

// 2. Mock Electron
vi.mock('electron', () => ({
    app: {
        getPath: () => mocks.userDataPath
    },
    ipcMain: {
        handle: vi.fn(),
        on: vi.fn()
    }
}))

// Import database AFTER mock
import {
    initDatabase,
    createTask,
    updateTask,
    createSubtask,
    checkAndGenerateContinuousTasks,
    getTask,
    getAllTasks,
    deleteTask,
    getSubtasks
} from '../../main/database'

describe('Database Logic Integration', () => {
    const dbDir = path.resolve(process.cwd(), mocks.userDataPath)

    beforeAll(async () => {
        // Ensure dir exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true })
        }
        await initDatabase()
    })

    afterAll(() => {
        try {
            fs.rmSync(dbDir, { recursive: true, force: true })
        } catch (e) {
            console.warn('Cleanup warning:', e)
        }
    })

    beforeEach(() => {
        // 
    })

    it('should correctly filter continuous subtasks using Local Time (Timezone Fix)', () => {
        // 1. Mock System Time to be 01:00 Local (Previous day UTC)
        // Assume Local is +08:00. 
        // 2026-01-02 01:00:00 Local = 2026-01-01 17:00:00 UTC
        const mockNow = new Date('2026-01-01T17:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockNow)

        // Mock Timezone Offset to -480 (UTC+8)
        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset
        Date.prototype.getTimezoneOffset = () => -480

        try {
            const parentId = 'parent-lz-1'
            const todayStr = '2026-01-02'

            createTask({
                id: parentId,
                title: 'Continuous Parent',
                auto_generate_daily: true,
                start_date: todayStr,
                due_date: '2026-12-31',
                status: 'todo',
                priority: 'high',
                is_pinned: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })

            // Subtask Today (Should be included)
            createSubtask({
                id: 'sub-lz-1',
                task_id: parentId,
                title: 'Subtask Today',
                start_date: todayStr,
                completed: false,
                order: 0
            })

            // Subtask Tomorrow (Should NOT be included)
            createSubtask({
                id: 'sub-lz-2',
                task_id: parentId,
                title: 'Subtask Tomorrow',
                start_date: '2026-01-03',
                completed: false,
                order: 1
            })

            const result = checkAndGenerateContinuousTasks(parentId)
            expect(result.generated).toBe(1)

            const allTasks = getAllTasks()
            const generatedTask = allTasks.find(t => t.parent_id === parentId && t.id.startsWith('task-daily-'))
            expect(generatedTask).toBeDefined()

            const subtasks = getSubtasks(generatedTask!.id)
            expect(subtasks.length).toBe(1)
            expect(subtasks[0].title).toBe('Subtask Today')

        } finally {
            Date.prototype.getTimezoneOffset = originalGetTimezoneOffset
            vi.useRealTimers()
        }
    })

    it('should complete parent continuous task when last daily instance is completed (Sync Completion)', () => {
        const parentId = 'parent-sync-1'
        const todayStr = new Date().toISOString().split('T')[0]

        createTask({
            id: parentId,
            title: 'Parent Sync',
            auto_generate_daily: true,
            start_date: todayStr,
            due_date: todayStr, // Last Day
            status: 'todo',
            priority: 'medium',
            is_pinned: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })

        checkAndGenerateContinuousTasks(parentId)

        const allTasks = getAllTasks()
        const dailyTask = allTasks.find(t => t.parent_id === parentId && t.title.includes('Parent Sync'))
        expect(dailyTask).toBeDefined()

        if (dailyTask) {
            updateTask({
                ...dailyTask,
                status: 'done',
                updated_at: new Date().toISOString()
            })
        }

        const updatedParent = getTask(parentId)
        expect(updatedParent?.status).toBe('done')
    })
})
