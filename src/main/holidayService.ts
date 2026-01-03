/**
 * 主进程节假日服务 - 用于周期任务调度
 * 从 public/holiday/YYYY-holiday.json 读取节假日数据
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

// 节假日类型数据
interface TypeEntry {
    type: 1 | 2 | 3  // 1=周末, 2=法定假日, 3=补班(工作日)
    name: string
    week: number
}

interface HolidayData {
    type: Record<string, TypeEntry>
}

// 缓存已加载的节假日数据 (key: year)
const holidayCache: Map<number, HolidayData> = new Map()

/**
 * 加载指定年份的节假日数据 (同步)
 */
function loadHolidayData(year: number): HolidayData | null {
    if (holidayCache.has(year)) {
        return holidayCache.get(year)!
    }

    try {
        // 获取节假日文件路径
        const holidayPath = app.isPackaged
            ? join(process.resourcesPath, 'public', 'holiday', `${year}-holiday.json`)
            : join(__dirname, '..', '..', 'public', 'holiday', `${year}-holiday.json`)

        if (!existsSync(holidayPath)) {
            return null
        }

        const content = readFileSync(holidayPath, 'utf-8')
        const data = JSON.parse(content)

        const holidayData: HolidayData = {
            type: data.type || {}
        }

        holidayCache.set(year, holidayData)
        return holidayData
    } catch (e) {
        console.error(`[HolidayService-Main] Failed to load ${year} holiday data:`, e)
        return null
    }
}

/**
 * 检查指定日期是否为真正的工作日
 * 工作日 = 非周末 且 非法定假日，或者是补班日
 */
export function isRealWorkday(dateStr: string): boolean {
    const year = parseInt(dateStr.substring(0, 4), 10)
    const data = loadHolidayData(year)

    if (!data) {
        // 没有节假日数据，回退到简单的周一至周五判断
        const date = new Date(dateStr)
        const day = date.getDay()
        return day >= 1 && day <= 5
    }

    const typeEntry = data.type[dateStr]
    if (typeEntry) {
        // type 3 = 补班日 (工作日)
        if (typeEntry.type === 3) return true
        // type 1 = 周末, type 2 = 法定假日
        if (typeEntry.type === 1 || typeEntry.type === 2) return false
    }

    // 没有特殊标记，按照普通工作日判断 (周一到周五)
    const date = new Date(dateStr)
    const day = date.getDay()
    return day >= 1 && day <= 5
}

/**
 * 检查指定日期是否为真正的休息日
 * 休息日 = 周末 或 法定假日，但不包括补班日
 */
export function isRealHoliday(dateStr: string): boolean {
    const year = parseInt(dateStr.substring(0, 4), 10)
    const data = loadHolidayData(year)

    if (!data) {
        // 没有节假日数据，回退到简单的周六日判断
        const date = new Date(dateStr)
        const day = date.getDay()
        return day === 0 || day === 6
    }

    const typeEntry = data.type[dateStr]
    if (typeEntry) {
        // type 1 = 周末, type 2 = 法定假日
        if (typeEntry.type === 1 || typeEntry.type === 2) return true
        // type 3 = 补班日 (不是休息日)
        if (typeEntry.type === 3) return false
    }

    // 没有特殊标记，按照普通周末判断
    const date = new Date(dateStr)
    const day = date.getDay()
    return day === 0 || day === 6
}

/**
 * 预加载节假日数据
 */
export function preloadHolidayData(years: number[]): void {
    for (const year of years) {
        loadHolidayData(year)
    }
}
