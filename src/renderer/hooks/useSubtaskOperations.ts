import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Task, Subtask } from '../store/tasksSlice'

export interface SubtaskItem {
    id?: string
    title: string
    description?: string
    priority?: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    completed: boolean
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
    reminder_sent?: boolean
    // Helper to track if this is a pending deletion
    isDeleted?: boolean
}

interface UseSubtaskOperationsProps {
    task?: Task | null
    isEditing: boolean
}

export const useSubtaskOperations = ({ task, isEditing }: UseSubtaskOperationsProps) => {
    // Local subtasks for new task creation
    const [localSubtasks, setLocalSubtasks] = useState<SubtaskItem[]>([])

    // For editing mode: track pending changes
    const [pendingNewSubtasks, setPendingNewSubtasks] = useState<SubtaskItem[]>([])
    const [pendingDeleteSubtaskIds, setPendingDeleteSubtaskIds] = useState<string[]>([])
    // Track updates to existing subtasks (keyed by subtask id)
    const [pendingSubtaskUpdates, setPendingSubtaskUpdates] = useState<Record<string, Partial<SubtaskItem>>>({})

    // Reset state
    const reset = useCallback(() => {
        setLocalSubtasks([])
        setPendingNewSubtasks([])
        setPendingDeleteSubtaskIds([])
        setPendingSubtaskUpdates({})
    }, [])

    // Initialize from task if needed (usually handled by parent, but we provide reset)

    const addSubtask = useCallback((subtask: SubtaskItem) => {
        if (isEditing && task) {
            setPendingNewSubtasks(prev => [...prev, subtask])
        } else {
            setLocalSubtasks(prev => [...prev, subtask])
        }
    }, [isEditing, task])

    const updateSubtask = useCallback((index: number, subtaskId: string | undefined, updates: Partial<SubtaskItem>) => {
        if (subtaskId && isEditing && task) {
            // Updating an existing committed subtask
            setPendingSubtaskUpdates(prev => ({
                ...prev,
                [subtaskId]: { ...prev[subtaskId], ...updates }
            }))
        } else {
            // Updating a pending new subtask or a local subtask
            if (isEditing && task) {
                // It's in pendingNewSubtasks
                // We need to find the index in pendingNewSubtasks
                // The passed index is the global display index.
                // We need to calculate the index relative to pendingNewSubtasks.
                const existingCount = (task.subtasks || []).filter(st => !pendingDeleteSubtaskIds.includes(st.id)).length
                const pendingIndex = index - existingCount

                if (pendingIndex >= 0) {
                    setPendingNewSubtasks(prev => {
                        const newPending = [...prev]
                        if (newPending[pendingIndex]) {
                            newPending[pendingIndex] = { ...newPending[pendingIndex], ...updates }
                        }
                        return newPending
                    })
                }
            } else {
                // Updating localSubtasks
                setLocalSubtasks(prev => {
                    const newLocal = [...prev]
                    if (newLocal[index]) {
                        newLocal[index] = { ...newLocal[index], ...updates }
                    }
                    return newLocal
                })
            }
        }
    }, [isEditing, task, pendingDeleteSubtaskIds])

    // Specific update functions for convenience
    const updateSubtaskPriority = useCallback((index: number, subtaskId: string | undefined, priority: SubtaskItem['priority']) => {
        updateSubtask(index, subtaskId, { priority })
    }, [updateSubtask])

    const updateSubtaskDescription = useCallback((index: number, subtaskId: string | undefined, description: string) => {
        updateSubtask(index, subtaskId, { description })
    }, [updateSubtask])

    const updateSubtaskReminder = useCallback((index: number, subtaskId: string | undefined, reminderData: Partial<SubtaskItem>) => {
        updateSubtask(index, subtaskId, reminderData)
    }, [updateSubtask])

    const deleteSubtask = useCallback((index: number, subtaskId?: string) => {
        if (isEditing && task) {
            if (subtaskId) {
                // Mark existing subtask for deletion
                setPendingDeleteSubtaskIds(prev => [...prev, subtaskId])
            } else {
                // Remove from pendingNewSubtasks
                const existingCount = (task.subtasks || []).filter(st => !pendingDeleteSubtaskIds.includes(st.id)).length
                const pendingIndex = index - existingCount

                if (pendingIndex >= 0) {
                    setPendingNewSubtasks(prev => {
                        const newPending = [...prev]
                        newPending.splice(pendingIndex, 1)
                        return newPending
                    })
                }
            }
        } else {
            setLocalSubtasks(prev => {
                const newLocal = [...prev]
                newLocal.splice(index, 1)
                return newLocal
            })
        }
    }, [isEditing, task, pendingDeleteSubtaskIds])

    // Compute displayed subtasks
    const displayedSubtasks = isEditing && task
        ? [
            ...(task.subtasks || []).filter(st => !pendingDeleteSubtaskIds.includes(st.id)),
            ...pendingNewSubtasks
        ]
        : localSubtasks

    return {
        localSubtasks,
        pendingNewSubtasks,
        pendingDeleteSubtaskIds,
        pendingSubtaskUpdates,
        displayedSubtasks,
        addSubtask,
        updateSubtask,
        updateSubtaskPriority,
        updateSubtaskDescription,
        updateSubtaskReminder,
        deleteSubtask,
        reset
    }
}
