import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { DroppablePanel, DroppablePanelProps } from '../../renderer/components/dashboard/DroppablePanel'
import '@testing-library/jest-dom'

// Mock dnd-kit hooks
vi.mock('@dnd-kit/core', () => ({
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    DndContext: ({ children }: any) => <div>{children}</div>
}))

vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: any) => <div>{children}</div>,
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null,
        isDragging: false
    }),
    verticalListSortingStrategy: {}
}))

vi.mock('@dnd-kit/utilities', () => ({
    CSS: { Transform: { toString: () => '' } }
}))

// Mock Sub Components
vi.mock('../../renderer/components/GlassPanel', () => ({
    GlassPanel: ({ children }: any) => <div className="glass-panel-mock">{children}</div>
}))
vi.mock('../../renderer/components/TaskCard', () => ({
    TaskCard: ({ task }: any) => <div className="task-card-mock">{task.title}</div>
}))

describe('DroppablePanel', () => {
    const defaultProps: DroppablePanelProps = {
        id: 'panel-1',
        title: 'Test Panel',
        icon: <span>Icon</span>,
        countColor: 'bg-red-500',
        tasks: [],
        onToggleStatus: vi.fn(),
        onEditTask: vi.fn(),
        onDeleteTask: vi.fn(),
        onTogglePin: vi.fn(),
        onAddSubtask: vi.fn(),
        onToggleSubtask: vi.fn()
    }

    test('renders panel title and tasks', () => {
        const tasks = [
            { id: '1', title: 'Task 1', status: 'todo' },
            { id: '2', title: 'Task 2', status: 'todo' }
        ] as any

        render(<DroppablePanel {...defaultProps} tasks={tasks} />)

        expect(screen.getByText('Test Panel')).toBeInTheDocument()
        expect(screen.getByText('Task 1')).toBeInTheDocument()
        expect(screen.getByText('Task 2')).toBeInTheDocument()
    })

    test('renders input bar when provided', () => {
        const setInputValue = vi.fn()
        render(
            <DroppablePanel
                {...defaultProps}
                inputPlaceholder="Add Task..."
                inputValue=""
                setInputValue={setInputValue}
                onAddTask={vi.fn()}
            />
        )
        expect(screen.getByPlaceholderText('Add Task...')).toBeInTheDocument()
    })
})
