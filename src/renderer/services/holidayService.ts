/**
 * Holiday Service - 节假日数据加载与查询
 * 
 * 从 public/holiday/YYYY-holiday.json 加载节假日数据
 * 提供日期查询接口，返回节假日类型信息
 */

// 节假日数据接口
interface HolidayEntry {
    date: string
    holiday: boolean  // true=休息, false=补班
    name: string
    wage: number
    rest?: number
    after?: boolean
    target?: string
}

interface TypeEntry {
    type: 1 | 2 | 3  // 1=周末, 2=法定假日, 3=补班
    name: string
    week: number
}

interface HolidayData {
    holiday: Record<string, HolidayEntry>
    type: Record<string, TypeEntry>
}

// 节假日查询结果
export interface HolidayInfo {
    isHoliday: boolean      // 是否休息日
    isWorkday: boolean      // 是否补班日
    type: 1 | 2 | 3 | null  // 1=周末, 2=法定假日, 3=补班, null=普通工作日
    name: string | null     // 节日名称
    wage?: number           // 工资倍数
}

// 缓存已加载的节假日数据 (key: year)
const holidayCache: Map<number, HolidayData> = new Map()

// 加载中的 Promise 缓存，防止重复请求
const loadingPromises: Map<number, Promise<HolidayData | null>> = new Map()

/**
 * 加载指定年份的节假日数据
 */
export async function loadHolidayData(year: number): Promise<HolidayData | null> {
    // 已缓存
    if (holidayCache.has(year)) {
        return holidayCache.get(year)!
    }

    // 正在加载中
    if (loadingPromises.has(year)) {
        return loadingPromises.get(year)!
    }

    // 开始加载
    const loadPromise = (async () => {
        try {
            // 在 Electron 环境中，public 目录资源通过相对路径访问
            const response = await fetch(`/holiday/${year}-holiday.json`)
            if (!response.ok) {
                console.warn(`[HolidayService] Failed to load ${year} holiday data: ${response.status}`)
                return null
            }
            const data = await response.json() as { code?: number; holiday: Record<string, HolidayEntry>; type: Record<string, TypeEntry> }

            const holidayData: HolidayData = {
                holiday: data.holiday || {},
                type: data.type || {}
            }

            holidayCache.set(year, holidayData)
            console.log(`[HolidayService] Loaded ${year} holiday data:`, {
                typeEntries: Object.keys(holidayData.type).length,
                holidayEntries: Object.keys(holidayData.holiday).length,
                sampleTypeKeys: Object.keys(holidayData.type).slice(0, 5),
                sampleHolidayKeys: Object.keys(holidayData.holiday).slice(0, 5)
            })
            return holidayData
        } catch (error) {
            console.error(`[HolidayService] Error loading ${year} holiday data:`, error)
            return null
        } finally {
            loadingPromises.delete(year)
        }
    })()

    loadingPromises.set(year, loadPromise)
    return loadPromise
}

/**
 * 查询日期的节假日信息
 * @param dateStr 日期字符串，格式 YYYY-MM-DD
 */
export function getHolidayInfo(dateStr: string): HolidayInfo {
    const defaultInfo: HolidayInfo = {
        isHoliday: false,
        isWorkday: false,
        type: null,
        name: null
    }

    if (!dateStr || dateStr.length !== 10) return defaultInfo

    const year = parseInt(dateStr.substring(0, 4), 10)
    const data = holidayCache.get(year)

    if (!data) return defaultInfo

    // 优先使用 type 数据 (按完整日期索引)
    const typeEntry = data.type[dateStr]
    if (typeEntry) {
        return {
            isHoliday: typeEntry.type === 1 || typeEntry.type === 2,
            isWorkday: typeEntry.type === 3,
            type: typeEntry.type,
            name: typeEntry.name
        }
    }

    // 回退到 holiday 数据 (按 MM-DD 索引)
    const mmdd = dateStr.substring(5)  // "MM-DD"
    const holidayEntry = data.holiday[mmdd]
    if (holidayEntry && holidayEntry.date === dateStr) {
        const isHoliday = holidayEntry.holiday
        return {
            isHoliday,
            isWorkday: !isHoliday,
            type: isHoliday ? (holidayEntry.wage === 3 ? 2 : 1) : 3,
            name: holidayEntry.name,
            wage: holidayEntry.wage
        }
    }

    return defaultInfo
}

/**
 * 预加载多个年份数据
 */
export async function preloadHolidayData(years: number[]): Promise<void> {
    await Promise.all(years.map(year => loadHolidayData(year)))
}

/**
 * 检查是否为普通周末 (周六/周日)
 * 仅当节假日数据中没有该日期时，根据星期判断
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}

/**
 * 获取日期的显示样式类名
 */
export function getHolidayClassName(dateStr: string): string {
    const info = getHolidayInfo(dateStr)

    if (info.type === 2) {
        // 法定节假日 - 红色背景
        return 'bg-red-50 text-red-600'
    } else if (info.type === 3) {
        // 补班日 - 黄色边框
        return 'border-l-2 border-yellow-500 bg-yellow-50/30'
    } else if (info.type === 1) {
        // 普通周末 - 浅灰背景
        return 'bg-gray-50/50 text-gray-500'
    }

    return ''
}
