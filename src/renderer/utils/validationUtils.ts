/**
 * 验证和任务相关的通用工具函数
 */

// 验证结果接口
export interface ValidationResult {
    isValid: boolean
    message?: string
}

/**
 * 验证子任务日期范围
 * @param subtaskDate - 子任务日期 (YYYY-MM-DD)
 * @param parentStart - 父任务开始日期 (YYYY-MM-DD)
 * @param parentDue - 父任务截止日期 (YYYY-MM-DD)
 * @param dateLabel - 日期标签 (用于错误消息，如 '开始日期' 或 '截止日期')
 */
export function validateDateRange(
    subtaskDate: string | undefined,
    parentStart: string | undefined,
    parentDue: string | undefined,
    dateLabel: string
): ValidationResult {
    if (!subtaskDate) return { isValid: true }

    // 格式化日期确保只比较 YYYY-MM-DD 部分
    const date = subtaskDate.split('T')[0]
    const pStart = parentStart?.split('T')[0]
    const pDue = parentDue?.split('T')[0]

    if (pStart && date < pStart) {
        return { isValid: false, message: `${dateLabel}早于主任务` }
    }
    if (pDue && date > pDue) {
        return { isValid: false, message: `${dateLabel}晚于主任务` }
    }

    return { isValid: true }
}

/**
 * 验证子任务的完整日期逻辑 (开始、截止、范围)
 */
export function validateSubtaskDates(
    startDate: string | undefined,
    startHour: number | undefined,
    startMinute: number | undefined,
    dueDate: string | undefined,
    dueHour: number | undefined,
    dueMinute: number | undefined,
    parentStartDate: string | undefined,
    parentDueDate: string | undefined
): ValidationResult {
    // 1. 验证开始日期范围
    const startValidation = validateDateRange(startDate, parentStartDate, parentDueDate, '开始日期')
    if (!startValidation.isValid) return startValidation

    // 2. 验证截止日期范围
    const dueValidation = validateDateRange(dueDate, parentStartDate, parentDueDate, '截止日期')
    if (!dueValidation.isValid) return dueValidation

    // 3. 验证开始 < 截止
    if (startDate && dueDate) {
        const startH = startHour ?? 0
        const startM = startMinute ?? 0
        const dueH = dueHour ?? 23
        const dueM = dueMinute ?? 59

        const start = new Date(`${startDate}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`)
        const due = new Date(`${dueDate}T${String(dueH).padStart(2, '0')}:${String(dueM).padStart(2, '0')}:00`)

        if (start > due) {
            return { isValid: false, message: '开始时间不能晚于截止时间' }
        }
    }

    return { isValid: true }
}

/**
 * 获取默认提醒时间 (基于开始时间 + 30分钟)
 * 如果没有提供开始时间，使用当前时间或默认 9:00 + 30m
 */
export function getDefaultReminderTime(
    startDate: string | undefined,
    startHour: number = 9,
    startMinute: number = 0
): { date: string; hour: number; minute: number } {
    // 如果没有日期，使用今天 (本地时间)
    let baseDateStr = startDate
    if (!baseDateStr) {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        baseDateStr = `${year}-${month}-${day}`
    } else if (baseDateStr.includes('T')) {
        // 解析 ISO 字符串为本地日期
        const d = new Date(baseDateStr)
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            baseDateStr = `${year}-${month}-${day}`
        } else {
            baseDateStr = baseDateStr.split('T')[0]
        }
    }

    // 构建 Date 对象 (本地时间)
    const d = new Date(`${baseDateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`)

    // 增加 30 分钟
    d.setMinutes(d.getMinutes() + 30)

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    return {
        date: `${year}-${month}-${day}`,
        hour: d.getHours(),
        minute: d.getMinutes()
    }
}
