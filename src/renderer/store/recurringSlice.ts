import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

// Types
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'workday' | 'holiday' | 'custom'

export interface RecurringTemplate {
    id: string
    title: string
    frequency: RecurringFrequency
    time: string
    reminderTime?: string
    priority?: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    enabled: boolean
    lastGenerated?: string
    startDate?: string
    weekDays?: number[]
    monthDays?: number[]
    intervalDays?: number
    remindDayOffsets?: number[]
    created_at?: string
    updated_at?: string
}

interface RecurringState {
    templates: RecurringTemplate[]
    loading: boolean
    error: string | null
    selectedId: string | null
}

const initialState: RecurringState = {
    templates: [],
    loading: false,
    error: null,
    selectedId: null
}

// Async thunks
export const fetchRecurringTemplates = createAsyncThunk(
    'recurring/fetchAll',
    async () => {
        const templates = await window.electronAPI?.getAllRecurringTemplates?.()
        return templates || []
    }
)

export const createRecurringTemplate = createAsyncThunk(
    'recurring/create',
    async (template: Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'>) => {
        const newTemplate = {
            ...template,
            id: `rt-${Date.now()}`
        }
        const result = await window.electronAPI?.createRecurringTemplate?.(newTemplate)
        return result
    }
)

export const updateRecurringTemplate = createAsyncThunk(
    'recurring/update',
    async (template: RecurringTemplate) => {
        const result = await window.electronAPI?.updateRecurringTemplate?.(template)
        return result
    }
)

export const deleteRecurringTemplate = createAsyncThunk(
    'recurring/delete',
    async (id: string) => {
        await window.electronAPI?.deleteRecurringTemplate?.(id)
        return id
    }
)

const recurringSlice = createSlice({
    name: 'recurring',
    initialState,
    reducers: {
        setSelectedTemplate: (state, action: PayloadAction<string | null>) => {
            state.selectedId = action.payload
        },
        clearError: (state) => {
            state.error = null
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchRecurringTemplates.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchRecurringTemplates.fulfilled, (state, action) => {
                state.loading = false
                state.templates = action.payload
            })
            .addCase(fetchRecurringTemplates.rejected, (state, action) => {
                state.loading = false
                state.error = action.error.message || 'Failed to fetch templates'
            })
            // Create
            .addCase(createRecurringTemplate.fulfilled, (state, action) => {
                if (action.payload) {
                    state.templates.unshift(action.payload)
                    state.selectedId = action.payload.id
                }
            })
            // Update
            .addCase(updateRecurringTemplate.fulfilled, (state, action) => {
                if (action.payload) {
                    const index = state.templates.findIndex(t => t.id === action.payload.id)
                    if (index !== -1) {
                        state.templates[index] = action.payload
                    }
                }
            })
            // Delete
            .addCase(deleteRecurringTemplate.fulfilled, (state, action) => {
                state.templates = state.templates.filter(t => t.id !== action.payload)
                if (state.selectedId === action.payload) {
                    state.selectedId = state.templates.length > 0 ? state.templates[0].id : null
                }
            })
    }
})

export const { setSelectedTemplate, clearError } = recurringSlice.actions
export default recurringSlice.reducer
