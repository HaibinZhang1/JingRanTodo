import { useEffect, useState } from 'react'
import { getToday } from '../utils/dateUtils'

export function useToday(): string {
    const [today, setToday] = useState(() => getToday())

    useEffect(() => {
        let timer: number | null = null

        const scheduleNextCheck = () => {
            const now = new Date()
            const nextMinute = new Date(now)
            nextMinute.setMinutes(now.getMinutes() + 1, 0, 250)

            timer = window.setTimeout(() => {
                setToday(current => {
                    const next = getToday()
                    return next === current ? current : next
                })
                scheduleNextCheck()
            }, Math.max(1000, nextMinute.getTime() - now.getTime()))
        }

        scheduleNextCheck()

        return () => {
            if (timer !== null) {
                window.clearTimeout(timer)
            }
        }
    }, [])

    return today
}
