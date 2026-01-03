import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import TaskDetailModal from '../../renderer/components/TaskDetailModal'
import tasksReducer from '../../renderer/store/tasksSlice'
import settingsReducer from '../../renderer/store/settingsSlice'
import '@testing-library/jest-dom'

// Mock icons to avoid rendering issues
vi.mock('lucide-react', () => ({
    X: () => <span>X-Icon</span>,
    AlertTriangle: () => <span>Alert-Icon</span>,
    Clock: () => <span>Clock-Icon</span>,
    Plus: () => <span>Plus-Icon</span>,
    ChevronDown: () => <span>Chevron-Icon</span>,
    Check: () => <span>Check-Icon</span>,
    Calendar: () => <span>Calendar-Icon</span>
}))

// Mock GlassPanel to simplify structure
vi.mock('../../renderer/components/GlassPanel', () => ({
    GlassPanel: ({ children, className }: any) => <div className={`glass-panel-mock ${className}`}>{children}</div>
}))

// Create Helper
const createTestStore = (preloadedState = {}) => {
    return configureStore({
        reducer: {
            tasks: tasksReducer,
            settings: settingsReducer
        },
        preloadedState,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false
            })
    })
}

describe('TaskDetailModal', () => {
    let store: any

    beforeEach(() => {
        store = createTestStore()
        // Mock electronAPI
        window.electronAPI = {
            createTask: vi.fn(),
            updateTask: vi.fn(),
            createSubtask: vi.fn(),
            updateSubtask: vi.fn(),
            deleteSubtask: vi.fn(),
            createPanel: vi.fn(),
            updatePanel: vi.fn(),
            deletePanel: vi.fn(),
            getPanels: vi.fn().mockResolvedValue([]),
            onPanelUpdate: vi.fn(),
        } as any
    })

    test('renders create task modal correctly', () => {
        render(
            <Provider store={store}>
                <TaskDetailModal isOpen={true} onClose={() => { }} />
            </Provider>
        )

        expect(screen.getByText('新建任务')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('输入任务标题...')).toBeInTheDocument()
        expect(screen.getByText('任务标题')).toBeInTheDocument()
    })

    test('renders edit task modal with data', () => {
        const task = {
            id: 'task-1',
            title: 'Existing Task',
            description: 'Desc',
            priority: 'medium',
            status: 'todo',
            start_date: '2023-01-01',
            due_date: '2023-01-02',
            subtasks: []
        }

        render(
            <Provider store={store}>
                <TaskDetailModal isOpen={true} onClose={() => { }} task={task as any} />
            </Provider>
        )

        expect(screen.getByText('编辑任务')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Existing Task')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Desc')).toBeInTheDocument()
    })

    test('updates title input', () => {
        render(
            <Provider store={store}>
                <TaskDetailModal isOpen={true} onClose={() => { }} />
            </Provider>
        )

        const input = screen.getByPlaceholderText('输入任务标题...')
        fireEvent.change(input, { target: { value: 'New Title' } })
        expect(input).toHaveValue('New Title')
    })
})
