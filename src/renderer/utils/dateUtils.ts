/**
 * 日期工具函数
 * 使用本地时间而非 UTC 时间，避免时区问题
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式（本地时间）
 */
export function formatLocalDate(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * 获取今日日期字符串
 */
export function getToday(): string {
    return formatLocalDate(new Date())
}

/**
 * 格式化日期字符串为 input type="date" 所需的 YYYY-MM-DD 格式
 * 处理可能存在的斜杠 (YYYY/MM/DD)
 */
export function formatDateForInput(dateStr?: string | null): string {
    if (!dateStr) return ''
    // 将字符串解析为日期对象，然后格式化为本地日期
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return formatLocalDate(d)
}

/**
 * 获取明日日期字符串
 */
export function getTomorrow(): string {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatLocalDate(d)
}

/**
 * 获取本周日日期
 * 周一到周六返回本周日，周日返回当天
 */
export function getSunday(): string {
    const d = new Date()
    const day = d.getDay() // 0=周日, 1=周一, ..., 6=周六
    const daysUntilSunday = day === 0 ? 0 : (7 - day)
    d.setDate(d.getDate() + daysUntilSunday)
    return formatLocalDate(d)
}

/**
 * 获取下周一日期
 * 始终返回下一个周一的日期
 */
export function getNextMonday(): string {
    const d = new Date()
    const day = d.getDay() // 0=周日, 1=周一, ..., 6=周六
    // 周日(0): +1天, 周一(1): +7天, 周二(2): +6天, ..., 周六(6): +2天
    const daysUntilNextMonday = day === 0 ? 1 : (8 - day)
    d.setDate(d.getDate() + daysUntilNextMonday)
    return formatLocalDate(d)
}

/**
 * 解析 ISO 时间字符串，提取小时和分钟
 * @param isoStr - ISO 时间字符串 (YYYY-MM-DDTHH:mm:ss)
 * @returns { hour, minute } - 默认为 9:00
 */
export function parseIsoTime(isoStr: string | null | undefined): { hour: number; minute: number } {
    if (!isoStr?.includes('T')) return { hour: 9, minute: 0 }
    const time = isoStr.split('T')[1]
    const parts = time.split(':')
    return {
        hour: parseInt(parts[0] || '9', 10),
        minute: parseInt(parts[1] || '0', 10)
    }
}

/**
 * 组合日期和时间为 ISO 字符串
 * @param dateStr - 日期字符串 (YYYY-MM-DD)
 * @param hour - 小时 (0-23)
 * @param minute - 分钟 (0-59)
 * @returns ISO 字符串 (YYYY-MM-DDTHH:mm:ss)
 */
export function combineDateAndTime(dateStr: string, hour: number, minute: number): string {
    return `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}
