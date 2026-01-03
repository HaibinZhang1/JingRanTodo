import { describe, it, expect } from 'vitest'
import { validateDateRange, validateSubtaskDates, getDefaultReminderTime } from '../../renderer/utils/validationUtils'

describe('validationUtils', () => {
    describe('validateDateRange', () => {
        it('should return valid if no subtask date', () => {
            expect(validateDateRange(undefined, '2026-01-01', '2026-01-31', 'Start')).toEqual({ isValid: true })
        })

        it('should return invalid if subtask date before parent start', () => {
            const result = validateDateRange('2025-12-31', '2026-01-01', '2026-01-31', '开始日期')
            expect(result.isValid).toBe(false)
            expect(result.message).toContain('开始日期早于主任务')
        })

        it('should return invalid if subtask date after parent due', () => {
            const result = validateDateRange('2026-02-01', '2026-01-01', '2026-01-31', '截止日期')
            expect(result.isValid).toBe(false)
            expect(result.message).toContain('截止日期晚于主任务')
        })

        it('should return valid if date within range', () => {
            expect(validateDateRange('2026-01-15', '2026-01-01', '2026-01-31', '').isValid).toBe(true)
        })
    })

    describe('validateSubtaskDates', () => {
        it('should validate start > due', () => {
            const result = validateSubtaskDates(
                '2026-01-02', 10, 0,
                '2026-01-02', 9, 0,
                undefined, undefined
            )
            expect(result.isValid).toBe(false)
            expect(result.message).toContain('不能晚于')
        })

        it('should return valid for correct logic', () => {
            const result = validateSubtaskDates(
                '2026-01-02', 9, 0,
                '2026-01-02', 10, 0,
                undefined, undefined
            )
            expect(result.isValid).toBe(true)
        })
    })

    describe('getDefaultReminderTime', () => {
        it('should default to Start + 30 mins', () => {
            const result = getDefaultReminderTime('2026-01-01', 9, 0)
            expect(result.hour).toBe(9)
            expect(result.minute).toBe(30)
            expect(result.date).toBe('2026-01-01')
        })

        it('should carry over to next hour', () => {
            const result = getDefaultReminderTime('2026-01-01', 9, 45)
            expect(result.hour).toBe(10)
            expect(result.minute).toBe(15)
        })

        it('should carry over to next day', () => {
            const result = getDefaultReminderTime('2026-01-01', 23, 45)
            expect(result.hour).toBe(0)
            expect(result.minute).toBe(15)
            // date checks might depend on timezone or library impl but string logic should work
            // implementation used Date object, so it handles rollover
            expect(result.date).toBe('2026-01-02')
        })
    })
})
