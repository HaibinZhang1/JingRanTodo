import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

export interface Note {
    id: string
    title: string
    content: string
    updatedAt: number
    isFloating: boolean
    isPinned: boolean
    position: { x: number; y: number }
    width: number
    height: number
    zIndex: number
    mode: 'edit' | 'split' | 'preview'
    showOnDashboard: boolean
    dashboardOrder: number
    showHeader?: boolean
}

interface NotesState {
    notes: Note[]
    loading: boolean
    error: string | null
    pendingFullScreenId: { id: string, source?: 'board' | 'list' } | null
}

const initialState: NotesState = {
    notes: [],
    loading: false,
    error: null,
    pendingFullScreenId: null
}

export const fetchNotes = createAsyncThunk(
    'notes/fetchNotes',
    async () => {
        const notes = await window.electronAPI.getAllNotes()
        return notes
    }
)

export const addNote = createAsyncThunk(
    'notes/addNote',
    async (note: Partial<Note>) => {
        const newNote = await window.electronAPI.createNote(note)
        return newNote
    }
)

export const editNote = createAsyncThunk(
    'notes/editNote',
    async (note: Partial<Note> & { id: string }) => {
        const updatedNote = await window.electronAPI.updateNote(note)
        return updatedNote
    }
)

export const removeNote = createAsyncThunk(
    'notes/removeNote',
    async (id: string) => {
        await window.electronAPI.deleteNote(id)
        return id
    }
)

export const toggleNoteFloat = createAsyncThunk(
    'notes/toggleFloat',
    async (id: string, { getState, rejectWithValue }) => {
        try {
            const state = getState() as any
            const note = state.notes.notes.find((n: Note) => n.id === id)
            if (!note) {
                console.error('Note not found:', id)
                return rejectWithValue('Note not found')
            }

            if (!note.isFloating) {
                // 开启悬浮：创建窗口
                await window.electronAPI.noteWindowCreate({
                    id: note.id,
                    x: note.position?.x,
                    y: note.position?.y,
                    width: note.width,
                    height: note.height,
                    zIndex: note.zIndex
                })
                // 更新状态
                return await window.electronAPI.updateNote({ id, isFloating: true })
            } else {
                // 关闭悬浮：关闭窗口
                await window.electronAPI.noteWindowClose(id)
                return await window.electronAPI.updateNote({ id, isFloating: false })
            }
        } catch (error) {
            console.error('toggleNoteFloat error:', error)
            return rejectWithValue((error as any)?.message || 'Unknown error')
        }
    }
)

export const toggleNotePin = createAsyncThunk(
    'notes/togglePin',
    async (id: string, { getState }) => {
        const state = getState() as any
        const note = state.notes.notes.find((n: Note) => n.id === id)
        if (!note) throw new Error('Note not found')

        const updatedNote = await window.electronAPI.updateNote({
            id,
            isPinned: !note.isPinned
        })
        return updatedNote
    }
)

// 切换笔记在主页显示状态
export const toggleNoteDashboard = createAsyncThunk(
    'notes/toggleDashboard',
    async (id: string, { getState }) => {
        const state = getState() as any
        const notes = state.notes.notes as Note[]
        const note = notes.find((n: Note) => n.id === id)
        if (!note) throw new Error('Note not found')

        // 计算新的排序位置（添加到末尾）
        const dashboardNotes = notes.filter((n: Note) => n.showOnDashboard)
        const newOrder = note.showOnDashboard ? 0 : (dashboardNotes.length + 1)

        const updatedNote = await window.electronAPI.updateNote({
            id,
            showOnDashboard: !note.showOnDashboard,
            dashboardOrder: newOrder
        })
        return updatedNote
    }
)

const notesSlice = createSlice({
    name: 'notes',
    initialState,
    reducers: {
        setPendingFullScreenId: (state, action: PayloadAction<{ id: string, source?: 'board' | 'list' } | null>) => {
            state.pendingFullScreenId = action.payload
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotes.pending, (state) => {
                if (state.notes.length === 0) {
                    state.loading = true
                }
                state.error = null
            })
            .addCase(fetchNotes.fulfilled, (state, action) => {
                state.loading = false
                state.notes = action.payload
            })
            .addCase(fetchNotes.rejected, (state, action) => {
                state.loading = false
                state.error = action.error.message || 'Failed to fetch notes'
            })
            .addCase(addNote.fulfilled, (state, action) => {
                state.notes.unshift(action.payload)
            })
            .addCase(editNote.fulfilled, (state, action) => {
                const index = state.notes.findIndex(n => n.id === action.payload.id)
                if (index !== -1) {
                    state.notes[index] = action.payload
                }
            })
            .addCase(removeNote.fulfilled, (state, action) => {
                state.notes = state.notes.filter(n => n.id !== action.payload)
            })
            .addCase(toggleNoteFloat.fulfilled, (state, action) => {
                if (action.payload) {
                    const index = state.notes.findIndex(n => n.id === action.payload.id)
                    if (index !== -1) {
                        state.notes[index] = action.payload
                    }
                }
            })
            .addCase(toggleNotePin.fulfilled, (state, action) => {
                if (action.payload) {
                    const index = state.notes.findIndex(n => n.id === action.payload.id)
                    if (index !== -1) {
                        state.notes[index] = action.payload
                    }
                }
            })
            .addCase(toggleNoteDashboard.fulfilled, (state, action) => {
                if (action.payload) {
                    const index = state.notes.findIndex(n => n.id === action.payload.id)
                    if (index !== -1) {
                        state.notes[index] = action.payload
                    }
                }
            })
    }
})

export const { setPendingFullScreenId } = notesSlice.actions
export default notesSlice.reducer
