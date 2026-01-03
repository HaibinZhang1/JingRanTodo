/**
 * 本地 NLP 解析引擎
 * 使用 chrono-node + 正则表达式解析自然语言任务
 */

import * as chrono from 'chrono-node'

// 创建中文解析器
const zhParser = chrono.zh.casual.clone()

/**
 * 预处理中文相对日期表达式
 * chrono-node 对某些中文相对日期支持不完善，需要手动替换
 */
function preprocessChineseRelativeDates(text: string): string {
    const now = new Date()

    // 大后天 (3天后)
    if (text.includes('大后天')) {
        const date = new Date(now)
        date.setDate(date.getDate() + 3)
        const formatted = `${date.getMonth() + 1}月${date.getDate()}日`
        text = text.replace(/大后天/g, formatted)
    }

    // 后天 (2天后)
    if (text.includes('后天')) {
        const date = new Date(now)
        date.setDate(date.getDate() + 2)
        const formatted = `${date.getMonth() + 1}月${date.getDate()}日`
        text = text.replace(/后天/g, formatted)
    }

    // 大前天 (3天前)
    if (text.includes('大前天')) {
        const date = new Date(now)
        date.setDate(date.getDate() - 3)
        const formatted = `${date.getMonth() + 1}月${date.getDate()}日`
        text = text.replace(/大前天/g, formatted)
    }

    // 前天 (2天前)
    if (text.includes('前天')) {
        const date = new Date(now)
        date.setDate(date.getDate() - 2)
        const formatted = `${date.getMonth() + 1}月${date.getDate()}日`
        text = text.replace(/前天/g, formatted)
    }

    return text
}

/**
 * 解析后的任务结构
 */
export interface ParsedTask {
    title: string
    dueDate?: string      // YYYY-MM-DD
    dueTime?: string      // HH:mm
    reminderTime?: string // HH:mm (提醒时间)
    hasReminder: boolean
    priority?: 'low' | 'medium' | 'high'
    tags: string[]
}

/**
 * 提醒关键词列表（可扩展）
 */
const REMINDER_KEYWORDS = [
    // 直接提醒
    '提醒', '提醒我', '叫我', '通知我', '告诉我', '通知',
    // 记忆类
    '记得', '别忘了', '别忘记', '不要忘记', '不要忘了', '记住',
    // 催促类
    '催我', '喊我', '叫醒我', '提示我', '提示',
    // 定时类
    '到时候', '到点', '准时', '按时',
    // 英文关键词
    'remind', 'reminder', 'notify', 'alert'
]

/**
 * 优先级关键词映射
 */
const PRIORITY_KEYWORDS: Record<string, 'low' | 'medium' | 'high'> = {
    // 高优先级
    '紧急': 'high', '重要': 'high', '尽快': 'high', '马上': 'high',
    '立即': 'high', '赶紧': 'high', '优先': 'high', '首要': 'high',
    '关键': 'high', '必须': 'high', 'urgent': 'high', 'important': 'high',
    'asap': 'high', '加急': 'high', '火急': 'high', '特急': 'high',
    // 中优先级
    '一般': 'medium', '普通': 'medium', '正常': 'medium',
    // 低优先级
    '不急': 'low', '有空': 'low', '闲时': 'low', '空闲': 'low',
    '随便': 'low', '顺便': 'low', 'low': 'low'
}

/**
 * 从文本中提取标签 (#tag)
 */
function extractTags(text: string): { tags: string[], cleanText: string } {
    const tagRegex = /#([\w\u4e00-\u9fa5]+)/g
    const tags: string[] = []
    let match

    while ((match = tagRegex.exec(text)) !== null) {
        tags.push(match[1])
    }

    const cleanText = text.replace(tagRegex, '').trim()
    return { tags, cleanText }
}

/**
 * 检测文本中是否包含提醒关键词
 */
function detectReminder(text: string): boolean {
    const lowerText = text.toLowerCase()
    return REMINDER_KEYWORDS.some(keyword =>
        lowerText.includes(keyword.toLowerCase())
    )
}

/**
 * 提取优先级
 */
function extractPriority(text: string): 'low' | 'medium' | 'high' | undefined {
    const lowerText = text.toLowerCase()

    for (const [keyword, priority] of Object.entries(PRIORITY_KEYWORDS)) {
        if (lowerText.includes(keyword.toLowerCase())) {
            return priority
        }
    }

    return undefined
}

/**
 * 清理标题文本
 * 移除日期时间、优先级关键词等
 */
function cleanTitle(text: string, parsedResults: chrono.ParsedResult[]): string {
    let cleaned = text

    // 移除已解析的日期时间文本
    for (const result of parsedResults) {
        // 转义可能存在的正则特殊字符
        const escapedText = result.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // 匹配 text 及其后可选的 "钟" 或 "时" (防止 "9点时" 这种少见表达残留)，忽略大小写
        const regex = new RegExp(`${escapedText}[钟]?`, 'gi')
        cleaned = cleaned.replace(regex, '')
    }

    // 移除优先级关键词
    for (const keyword of Object.keys(PRIORITY_KEYWORDS)) {
        const regex = new RegExp(keyword, 'gi')
        cleaned = cleaned.replace(regex, '')
    }

    // 移除提醒关键词（按长度排序，先匹配长的）
    const sortedKeywords = [...REMINDER_KEYWORDS].sort((a, b) => b.length - a.length)
    for (const keyword of sortedKeywords) {
        const regex = new RegExp(keyword, 'gi')
        cleaned = cleaned.replace(regex, '')
    }

    // 移除提前时间表达式 (如 "提前1小时20分钟", "提前30分钟", "10分钟前")
    // 移除提前时间表达式
    const NUM_PATTERN = '[\\d一二三四五六七八九十两半.]+'

    // 1. 复杂模式 "提前X小时Y分钟"
    cleaned = cleaned.replace(new RegExp(`提前\\s*${NUM_PATTERN}\\s*[小个]?时\\s*${NUM_PATTERN}\\s*分[钟]?`, 'g'), '')
    // 2. 小时模式 "提前X小时"
    cleaned = cleaned.replace(new RegExp(`提前\\s*${NUM_PATTERN}\\s*[小个]?时`, 'g'), '')
    // 3. 分钟模式 "提前X分钟"
    cleaned = cleaned.replace(new RegExp(`提前\\s*${NUM_PATTERN}\\s*分[钟]?`, 'g'), '')
    // 4. "X分钟前/后提醒" (虽然 extractAdvanceMinutes 没有处理 "X分钟后提醒"，但这里一起清理比较保险)
    cleaned = cleaned.replace(new RegExp(`${NUM_PATTERN}\\s*分[钟]?\\s*[前后]\\s*`, 'g'), '')
    // 5. "X小时前/后提醒"
    cleaned = cleaned.replace(new RegExp(`${NUM_PATTERN}\\s*[小个]?时\\s*[前后]\\s*`, 'g'), '')

    // 移除句首或句尾的独立"我"字
    cleaned = cleaned.replace(/^我\s*/g, '')
    cleaned = cleaned.replace(/\s*我$/g, '')
    // 移除动词后的"我" (如 "告诉我" 变成 "告诉" 后可能残留"我")
    cleaned = cleaned.replace(/\s+我\s+/g, ' ')

    // 清理多余空格和标点
    cleaned = cleaned
        .replace(/[,，:：]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return cleaned
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

/**
 * 利用 chrono 解析时间数量
 * @param quantity 数量词 (如 "5", "五", "半")
 * @param unit 单位 ("minute" | "hour")
 */
function parseTimeQuantity(quantity: string, unit: 'minute' | 'hour'): number {
    // 如果是纯数字，直接解析
    if (/^\d+(\.\d+)?$/.test(quantity)) {
        return parseFloat(quantity)
    }

    // 特殊处理 "半"
    if (quantity === '半') {
        return 0.5
    }

    // 利用 chrono 解析中文时间
    // 构造如 "五分钟后", "两小时后" 的句子让 chrono 解析
    const unitText = unit === 'minute' ? '分钟' : '小时'
    const textToParse = `${quantity}${unitText}后`

    const now = new Date()
    // 确保基准时间是整点，避免秒数干扰
    now.setMilliseconds(0)
    now.setSeconds(0)

    const parsedDate = zhParser.parseDate(textToParse, now, { forwardDate: true })

    if (parsedDate) {
        const diffMs = parsedDate.getTime() - now.getTime()
        // 转换为对应单位的数值
        if (unit === 'minute') {
            return Math.round(diffMs / 60000)
        } else {
            return diffMs / 3600000
        }
    }

    // 解析失败，回退到 trying simple parsing or return 0
    return 0
}

/**
 * 提取用户指定的提前时间（分钟数）
 * 支持: 提前10分钟, 提前五分钟, 提前1小时, 提前1小时30分钟, 提前半小时 等
 */
function extractAdvanceMinutes(text: string): number {
    // 默认提前0分钟（即任务时间就是提醒时间）
    const DEFAULT_ADVANCE = 0
    const NUM_PATTERN = '[\\d一二三四五六七八九十两半.]+'

    // 1. 优先匹配复杂模式: "提前X小时Y分钟"
    const hourMinuteRegex = new RegExp(`提前\\s*(${NUM_PATTERN})\\s*[小个]?时\\s*(${NUM_PATTERN})\\s*分[钟]?`)
    const hourMinuteMatch = text.match(hourMinuteRegex)
    if (hourMinuteMatch) {
        const hours = parseTimeQuantity(hourMinuteMatch[1], 'hour')
        const minutes = parseTimeQuantity(hourMinuteMatch[2], 'minute')
        return Math.floor(hours * 60 + minutes)
    }

    // 2. 匹配 "提前X小时" (没有分钟部分)
    const hourOnlyRegex = new RegExp(`提前\\s*(${NUM_PATTERN})\\s*[小个]?时(?!\\s*\\d)`)
    const hourOnlyMatch = text.match(hourOnlyRegex)
    if (hourOnlyMatch) {
        return Math.floor(parseTimeQuantity(hourOnlyMatch[1], 'hour') * 60)
    }

    // 3. 匹配 "提前X分钟" (确保前面不是"小时")
    const minuteRegex = new RegExp(`提前\\s*(${NUM_PATTERN})\\s*分[钟]?`)
    const minuteMatch = text.match(minuteRegex)
    if (minuteMatch) {
        // 检查是否是独立的分钟匹配（不是小时分钟组合的一部分）
        const fullRegex = new RegExp(`提前\\s*${NUM_PATTERN}\\s*[小个]?时`)
        if (!fullRegex.test(text)) {
            return Math.floor(parseTimeQuantity(minuteMatch[1], 'minute'))
        }
    }

    // 4. 匹配 "X分钟前/后提醒" (常见变体)
    const beforeMinRegex = new RegExp(`(${NUM_PATTERN})\\s*分[钟]?\\s*[前后]\\s*提醒`)
    const beforeMinMatch = text.match(beforeMinRegex)
    if (beforeMinMatch) {
        return Math.floor(parseTimeQuantity(beforeMinMatch[1], 'minute'))
    }

    // 5. 匹配 "X小时前/后提醒"
    const beforeHourRegex = new RegExp(`(${NUM_PATTERN})\\s*[小个]?时\\s*[前后]\\s*提醒`)
    const beforeHourMatch = text.match(beforeHourRegex)
    if (beforeHourMatch) {
        return Math.floor(parseTimeQuantity(beforeHourMatch[1], 'hour') * 60)
    }

    return DEFAULT_ADVANCE
}

/**
 * 计算提醒时间
 * @param dueTime 任务时间 HH:mm
 * @param advanceMinutes 提前分钟数
 */
function calculateReminderTime(dueTime: string, advanceMinutes: number): string {
    const [hours, minutes] = dueTime.split(':').map(Number)
    let totalMinutes = hours * 60 + minutes - advanceMinutes

    if (totalMinutes < 0) {
        totalMinutes = 0
    }

    const newHours = Math.floor(totalMinutes / 60) % 24
    const newMinutes = totalMinutes % 60

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
}

/**
 * 本地解析主函数
 */
export function parseLocally(text: string): ParsedTask {
    // 1. 提取标签
    const { tags, cleanText } = extractTags(text)

    // 1.5 预处理中文相对日期 (后天、大后天等)
    const preprocessedText = preprocessChineseRelativeDates(cleanText)

    // 2. 解析日期时间
    const parsedResults = zhParser.parse(preprocessedText, new Date(), {
        forwardDate: true // 优先解析为未来日期
    })

    // 3. 提取日期和时间
    let dueDate: string | undefined
    let dueTime: string | undefined

    if (parsedResults.length > 0) {
        const firstResult = parsedResults[0]
        const startDate = firstResult.start.date()

        // 始终获取日期
        dueDate = formatDate(startDate)

        // 只有当明确指定时间时才设置 dueTime
        if (firstResult.start.isCertain('hour')) {
            dueTime = formatTime(startDate)
        }
    }

    // 4. 检测提醒
    const hasReminder = detectReminder(text)

    // 5. 如果有提醒但没有时间，设置默认时间为当前时间
    if (hasReminder && !dueTime) {
        const now = new Date()
        // 默认设置为下一个整点
        now.setMinutes(0)
        now.setSeconds(0)
        now.setHours(now.getHours() + 1)
        dueTime = formatTime(now)

        // 如果没有日期，默认为今天
        if (!dueDate) {
            dueDate = formatDate(new Date())
        }
    }

    // 6. 计算提醒时间
    let reminderTime: string | undefined
    if (hasReminder && dueTime) {
        const advanceMinutes = extractAdvanceMinutes(text)
        reminderTime = calculateReminderTime(dueTime, advanceMinutes)
    }

    // 6. 提取优先级
    const priority = extractPriority(text)

    // 7. 清理标题
    const title = cleanTitle(cleanText, parsedResults) || cleanText

    return {
        title: title || text,
        dueDate,
        dueTime,
        reminderTime,
        hasReminder,
        priority,
        tags
    }
}

/**
 * 验证解析结果是否有内容
 */
export function hasParseResult(result: ParsedTask): boolean {
    return !!(
        result.dueDate ||
        result.dueTime ||
        result.reminderTime ||
        result.priority ||
        result.tags.length > 0
    )
}
