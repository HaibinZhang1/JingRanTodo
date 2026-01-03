import { configureStore } from '@reduxjs/toolkit'
import tasksReducer from './tasksSlice'
import settingsReducer from './settingsSlice'
import pomodoroReducer from './pomodoroSlice'
import notesReducer from './notesSlice'
import recurringReducer from './recurringSlice'

export const store = configureStore({
    reducer: {
        tasks: tasksReducer,
        settings: settingsReducer,
        pomodoro: pomodoroReducer,
        notes: notesReducer,
        recurring: recurringReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
})

// 类型推导
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
