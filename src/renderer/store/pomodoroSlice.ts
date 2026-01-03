import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// 类型定义
export type PomodoroStatus = 'idle' | 'working' | 'break' | 'paused'

export interface PomodoroSession {
    id: string
    task_id?: string
    start_time: string
    end_time?: string
    duration: number
    completed: boolean
}

export interface PomodoroState {
    status: PomodoroStatus
    currentTaskId?: string
    workDuration: number // 工作时长（秒）
    breakDuration: number // 休息时长（秒）
    remainingTime: number // 剩余时间（秒）
    sessionsCompleted: number // 今日完成的番茄数
    currentSession?: PomodoroSession
}

const DEFAULT_WORK_DURATION = 25 * 60 // 25分钟
const DEFAULT_BREAK_DURATION = 5 * 60 // 5分钟

const initialState: PomodoroState = {
    status: 'idle',
    workDuration: DEFAULT_WORK_DURATION,
    breakDuration: DEFAULT_BREAK_DURATION,
    remainingTime: DEFAULT_WORK_DURATION,
    sessionsCompleted: 0
}

// Slice
const pomodoroSlice = createSlice({
    name: 'pomodoro',
    initialState,
    reducers: {
        startPomodoro: (state, action: PayloadAction<string | undefined>) => {
            state.status = 'working'
            state.currentTaskId = action.payload
            state.remainingTime = state.workDuration
            state.currentSession = {
                id: Date.now().toString(),
                task_id: action.payload,
                start_time: new Date().toISOString(),
                duration: 0,
                completed: false
            }
        },
        pausePomodoro: (state) => {
            if (state.status === 'working' || state.status === 'break') {
                state.status = 'paused'
            }
        },
        resumePomodoro: (state) => {
            if (state.status === 'paused') {
                state.status = state.remainingTime <= state.breakDuration ? 'break' : 'working'
            }
        },
        stopPomodoro: (state) => {
            state.status = 'idle'
            state.currentTaskId = undefined
            state.remainingTime = state.workDuration
            state.currentSession = undefined
        },
        tick: (state) => {
            if (state.status === 'working' || state.status === 'break') {
                state.remainingTime -= 1

                if (state.remainingTime <= 0) {
                    if (state.status === 'working') {
                        // 工作结束，开始休息
                        state.status = 'break'
                        state.remainingTime = state.breakDuration
                        state.sessionsCompleted += 1
                        if (state.currentSession) {
                            state.currentSession.completed = true
                            state.currentSession.end_time = new Date().toISOString()
                            state.currentSession.duration = state.workDuration
                        }
                    } else {
                        // 休息结束，回到空闲
                        state.status = 'idle'
                        state.remainingTime = state.workDuration
                        state.currentSession = undefined
                    }
                }
            }
        },
        setWorkDuration: (state, action: PayloadAction<number>) => {
            state.workDuration = action.payload * 60
            if (state.status === 'idle') {
                state.remainingTime = state.workDuration
            }
        },
        setBreakDuration: (state, action: PayloadAction<number>) => {
            state.breakDuration = action.payload * 60
        },
        resetDailyStats: (state) => {
            state.sessionsCompleted = 0
        }
    }
})

export const {
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    tick,
    setWorkDuration,
    setBreakDuration,
    resetDailyStats
} = pomodoroSlice.actions

export default pomodoroSlice.reducer
