import '@testing-library/jest-dom'

// Mock window.electronAPI for renderer tests
Object.defineProperty(window, 'electronAPI', {
    value: {
        getAllTasks: jest.fn().mockResolvedValue([]),
        createTask: jest.fn().mockResolvedValue(undefined),
        updateTask: jest.fn().mockResolvedValue(undefined),
        deleteTask: jest.fn().mockResolvedValue(undefined),
        getSubtasks: jest.fn().mockResolvedValue([]),
        createSubtask: jest.fn().mockResolvedValue(undefined),
        updateSubtask: jest.fn().mockResolvedValue(undefined),
        deleteSubtask: jest.fn().mockResolvedValue(undefined),
        getAllNotes: jest.fn().mockResolvedValue([]),
        getSetting: jest.fn().mockResolvedValue(null),
        setSetting: jest.fn().mockResolvedValue(undefined),
        getAllPanels: jest.fn().mockResolvedValue([]),
    },
    writable: true,
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    },
})
