/**
 * Excel 文件解析器
 * 将 Excel 文件解析为任务和子任务数据
 * 基于列索引读取，不依赖标题名称
 */
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

// 列索引常量（新7列结构）
// 列索引常量（新10列结构）
const COL = {
    TYPE: 0,              // A列 - 任务类型
    TITLE: 1,             // B列 - 标题
    START_DATE: 2,        // C列 - 开始日期
    START_TIME: 3,        // D列 - 开始时间
    DUE_DATE: 4,          // E列 - 截止日期
    DUE_TIME: 5,          // F列 - 截止时间
    DESCRIPTION: 6,       // G列 - 描述
    PRIORITY: 7,          // H列 - 优先级
    REMINDER_DATE: 8,     // I列 - 提醒日期
    REMINDER_TIME: 9      // J列 - 提醒时间
}

// 任务类型常量
const TASK_TYPE = {
    TASK: ['任务', 'task', '主任务'],
    SUBTASK: ['子任务', 'subtask', '子']
}

// 解析后的子任务
export interface ParsedSubtask {
    id: string
    title: string
    description?: string
    priority: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    reminder_enabled: boolean
    reminder_date?: string
    reminder_hour?: number
    reminder_minute?: number
}

// 解析后的任务
export interface ParsedTask {
    id: string
    title: string
    description?: string
    priority: 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
    start_date?: string  // 开始日期
    due_date?: string
    panel_id?: string
    panel_name?: string // 用于显示，实际导入时转换为 panel_id
    reminder_enabled: boolean
    reminder_date?: string
    reminder_hour?: number
    reminder_minute?: number
    subtasks: ParsedSubtask[]
}

// 解析错误
export interface ParseError {
    row: number
    reason: string
}

// 解析结果
export interface ParseResult {
    success: ParsedTask[]
    errors: ParseError[]
    newPanels: string[] // 需要新建的面板名称列表
}

// 面板信息
export interface PanelInfo {
    id: string
    title: string
}

// 优先级映射
const PRIORITY_MAP: Record<string, ParsedTask['priority']> = {
    '非常低': 'very-low',
    '很低': 'very-low',
    'very-low': 'very-low',
    '低': 'low',
    'low': 'low',
    '中': 'medium',
    '中等': 'medium',
    'medium': 'medium',
    '高': 'high',
    'high': 'high',
    '非常高': 'very-high',
    '很高': 'very-high',
    'very-high': 'very-high',
}

/**
 * 获取单元格值为字符串
 */
function getCellString(row: any[], index: number): string | undefined {
    const val = row[index]
    if (val === undefined || val === null || val === '') return undefined
    return String(val).trim()
}

/**
 * 解析优先级字符串
 */
function parsePriority(value?: string): ParsedTask['priority'] {
    if (!value) return 'medium'
    const normalized = value.toLowerCase().trim()
    return PRIORITY_MAP[normalized] || 'medium'
}

/**
 * 解析日期（支持多种格式）
 */
function parseDate(value?: any): string | undefined {
    if (value === undefined || value === null || value === '') return undefined

    // Excel 日期序列号
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value)
        if (date) {
            const year = date.y
            const month = String(date.m).padStart(2, '0')
            const day = String(date.d).padStart(2, '0')
            return `${year}-${month}-${day}`
        }
        return undefined
    }

    // Date 对象 - 使用本地时间方法，避免因时区差异导致日期提前（例如本地0点对应UTC前一天）
    if (value instanceof Date) {
        const year = value.getFullYear()
        const month = String(value.getMonth() + 1).padStart(2, '0')
        const day = String(value.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // 字符串格式
    const str = String(value).trim()

    // YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    }

    // YYYY/MM/DD
    const slashMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
    if (slashMatch) {
        return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`
    }

    // MM/DD/YYYY
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (usMatch) {
        return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`
    }

    return undefined
}

/**
 * 解析时间（HH:MM 格式）
 */
function parseTime(value?: any): { hour: number; minute: number } | undefined {
    if (value === undefined || value === null || value === '') return undefined
    const str = String(value).trim()
    const match = str.match(/^(\d{1,2}):(\d{2})$/)
    if (match) {
        const hour = parseInt(match[1], 10)
        const minute = parseInt(match[2], 10)
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            return { hour, minute }
        }
    }
    return undefined
}

/**
 * 检查提醒是否已过期
 */
function isReminderExpired(reminderDate?: string, reminderHour?: number, reminderMinute?: number): boolean {
    if (!reminderDate || reminderHour === undefined || reminderMinute === undefined) {
        return false
    }

    const now = new Date()
    const reminderTime = new Date(`${reminderDate}T${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}:00`)

    return reminderTime < now
}

/**
 * 判断行类型
 * 注意：必须先检查子任务，因为"子任务"包含"任务"字符串
 */
function getRowType(typeValue?: string): 'task' | 'subtask' | null {
    if (!typeValue) return null
    const normalized = typeValue.toLowerCase().trim()
    // 先检查子任务（因为"子任务"包含"任务"）
    if (TASK_TYPE.SUBTASK.some(t => normalized.includes(t.toLowerCase()))) {
        return 'subtask'
    }
    if (TASK_TYPE.TASK.some(t => normalized.includes(t.toLowerCase()))) {
        return 'task'
    }
    return null
}

/**
 * 组合日期和时间为 ISO 格式 (无时区偏移，作为本地时间存储)
 * 如果只有日期默认时间 09:00 (开始/截止任务的常用默认值)
 */
function combineDateTimeIso(dateStr?: string, timeObj?: { hour: number; minute: number }): string | undefined {
    if (!dateStr) return undefined

    // 如果没有时间，默认为 09:00
    const hour = timeObj?.hour ?? 9
    const minute = timeObj?.minute ?? 0

    // YYYY-MM-DDTHH:mm:ss (不带 Z，表示本地时间)
    return `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

/**
 * 解析 Excel 文件（基于类型列）
 */
export function parseExcelFile(filePath: string, _existingPanels: PanelInfo[]): ParseResult {
    const result: ParseResult = {
        success: [],
        errors: [],
        newPanels: []
    }

    try {
        // 使用 fs.readFileSync 读取文件为 Buffer（支持中文路径）
        const fileBuffer = readFileSync(filePath)
        const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
            result.errors.push({ row: 0, reason: 'Excel 文件为空' })
            return result
        }

        const sheet = workbook.Sheets[sheetName]

        // 使用 header: 1 返回数组格式，按索引访问
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length <= 2) {
            result.errors.push({ row: 0, reason: '没有找到任何数据行（仅有说明行和标题行）' })
            return result
        }

        let currentTask: ParsedTask | null = null

        // 第1行是说明文字，第2行是标题行，从第3行开始解析数据
        for (let i = 2; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 1 // Excel 行号（1-based）

            // 读取类型列
            const typeValue = getCellString(row, COL.TYPE)
            const rowType = getRowType(typeValue)

            // 空行或无法识别类型的行，跳过
            if (!rowType) {
                continue
            }



            // 读取标题
            const title = getCellString(row, COL.TITLE)
            if (!title) {
                result.errors.push({ row: rowNum, reason: '标题不能为空' })
                continue
            }

            // 解析日期和时间
            let startDateStr = parseDate(row[COL.START_DATE])
            let startTimeObj = parseTime(row[COL.START_TIME])

            // 默认值逻辑：如果未填写开始日期/时间，使用当前日期和时间
            if (!startDateStr) {
                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, '0')
                const day = String(now.getDate()).padStart(2, '0')
                startDateStr = `${year}-${month}-${day}`
            }
            if (!startTimeObj && (!row[COL.START_DATE] || !row[COL.START_TIME])) {
                // 如果日期是默认生成的，或者用户没填时间，则默认使用当前时间
                // 用户要求：未填写时间时，开始日期和开始时间应该默认为当前时间和日期
                // 注意：如果用户填了日期没填时间，这里也会默认为当前时间的分秒，这可能符合也可能不符合预期，但符合“未填写时间...默认为当前时间”的字面意思
                const now = new Date()
                startTimeObj = { hour: now.getHours(), minute: now.getMinutes() }
            }

            const startDateTime = combineDateTimeIso(startDateStr, startTimeObj)

            // 解析截止日期和时间 (默认同开始时间)
            let dueDateStr = parseDate(row[COL.DUE_DATE])
            let dueTimeObj = parseTime(row[COL.DUE_TIME])

            if (!dueDateStr) {
                dueDateStr = startDateStr
            }
            if (!dueTimeObj) {
                dueTimeObj = startTimeObj
            }
            const dueDateTime = combineDateTimeIso(dueDateStr, dueTimeObj)

            // 解析提醒时间
            const reminderDate = parseDate(row[COL.REMINDER_DATE])
            const reminderTime = parseTime(row[COL.REMINDER_TIME])
            const reminderExpired = isReminderExpired(reminderDate, reminderTime?.hour, reminderTime?.minute)

            if (rowType === 'task') {
                // 保存之前的任务
                if (currentTask) {
                    result.success.push(currentTask)
                }

                // 创建新任务
                currentTask = {
                    id: randomUUID(),
                    title: title,
                    description: getCellString(row, COL.DESCRIPTION),
                    priority: parsePriority(getCellString(row, COL.PRIORITY)),
                    start_date: startDateTime,
                    due_date: dueDateTime,
                    panel_id: undefined,
                    panel_name: undefined,
                    reminder_enabled: !!(reminderDate && reminderTime && !reminderExpired),
                    reminder_date: reminderDate,
                    reminder_hour: reminderTime?.hour,
                    reminder_minute: reminderTime?.minute,
                    subtasks: []
                }
            } else if (rowType === 'subtask') {
                if (!currentTask) {
                    result.errors.push({ row: rowNum, reason: '子任务必须跟随在主任务之后' })
                    continue
                }

                // 创建子任务
                const subtask: ParsedSubtask = {
                    id: randomUUID(),
                    title: title,
                    description: getCellString(row, COL.DESCRIPTION),
                    priority: parsePriority(getCellString(row, COL.PRIORITY)),
                    reminder_enabled: !!(reminderDate && reminderTime && !reminderExpired),
                    reminder_date: reminderDate,
                    reminder_hour: reminderTime?.hour,
                    reminder_minute: reminderTime?.minute
                }

                currentTask.subtasks.push(subtask)
            }
        }

        // 保存最后一个任务
        if (currentTask) {
            result.success.push(currentTask)
        }

    } catch (error: any) {
        result.errors.push({ row: 0, reason: `读取 Excel 文件失败: ${error.message}` })
    }

    return result
}

