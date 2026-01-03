import React, { useEffect } from 'react'
import { Play, Pause, Square, Timer } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../hooks/useRedux'
import { startPomodoro, pausePomodoro, resumePomodoro, stopPomodoro, tick } from '../store/pomodoroSlice'
import GlassPanel from './GlassPanel'

const PomodoroTimer: React.FC = () => {
    const dispatch = useAppDispatch()
    const { status, remainingTime, sessionsCompleted } = useAppSelector(state => state.pomodoro)

    useEffect(() => {
        let interval: NodeJS.Timeout
        if (status === 'working' || status === 'break') {
            interval = setInterval(() => {
                dispatch(tick())
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [status, dispatch])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleToggle = () => {
        if (status === 'idle') dispatch(startPomodoro())
        else if (status === 'working' || status === 'break') dispatch(pausePomodoro())
        else if (status === 'paused') dispatch(resumePomodoro())
    }

    const handleStop = () => {
        dispatch(stopPomodoro())
    }

    const getStatusText = () => {
        switch (status) {
            case 'working': return '专注中'
            case 'break': return '休息中'
            case 'paused': return '已暂停'
            default: return '番茄钟'
        }
    }

    return (
        <GlassPanel variant="panel" className="w-64 p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700">
                <Timer size={18} />
                <span className="font-medium">{getStatusText()}</span>
            </div>

            <div className="text-4xl font-bold font-mono text-gray-800 tracking-wider">
                {formatTime(remainingTime)}
            </div>

            <div className="flex gap-4 w-full justify-center">
                <button
                    onClick={handleToggle}
                    className={`
                        p-3 rounded-full transition-all text-white shadow-lg
                        ${status === 'working' ? 'bg-orange-500 hover:bg-orange-600' :
                            status === 'break' ? 'bg-green-500 hover:bg-green-600' :
                                'bg-blue-500 hover:bg-blue-600'}
                    `}
                >
                    {status === 'working' || status === 'break' ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                </button>
                {(status !== 'idle') && (
                    <button
                        onClick={handleStop}
                        className="p-3 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                    >
                        <Square size={20} />
                    </button>
                )}
            </div>

            <div className="text-xs text-gray-500 mt-1">
                今日完成: {sessionsCompleted}
            </div>
        </GlassPanel>
    )
}

export default PomodoroTimer
