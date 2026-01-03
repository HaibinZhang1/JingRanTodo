import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.electronAPI for renderer tests
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'electronAPI', {
        value: {
            getAllTasks: vi.fn().mockResolvedValue([]),
            createTask: vi.fn().mockResolvedValue(undefined),
            updateTask: vi.fn().mockResolvedValue(undefined),
            deleteTask: vi.fn().mockResolvedValue(undefined),
            getSubtasks: vi.fn().mockResolvedValue([]),
            createSubtask: vi.fn().mockResolvedValue(undefined),
            updateSubtask: vi.fn().mockResolvedValue(undefined),
            deleteSubtask: vi.fn().mockResolvedValue(undefined),
            getAllNotes: vi.fn().mockResolvedValue([]),
            getSetting: vi.fn().mockResolvedValue(null),
            setSetting: vi.fn().mockResolvedValue(undefined),
            getAllPanels: vi.fn().mockResolvedValue([]),
        },
        writable: true,
    })
}

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    },
})
