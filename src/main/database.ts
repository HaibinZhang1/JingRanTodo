import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import initSqlJs, { Database as SqlJsDatabase, QueryExecResult } from 'sql.js'

// ============= 类型定义 =============

/** 任务优先级 */
export type Priority = 'very-low' | 'low' | 'medium' | 'high' | 'very-high'

/** 任务状态 */
export type TaskStatus = 'todo' | 'done'

/** 子任务数据结构 */
export interface SubtaskData {
  id: string
  task_id: string
  title: string
  description?: string | null
  priority?: Priority
  completed: boolean | number
  order?: number
  // 开始日期时间
  start_date?: string | null
  start_hour?: number | null
  start_minute?: number | null
  // 截止日期时间
  due_date?: string | null
  due_hour?: number | null
  due_minute?: number | null
  // 提醒字段
  reminder_enabled?: boolean | number
  reminder_date?: string | null
  reminder_hour?: number | null
  reminder_minute?: number | null
  reminder_sent?: boolean | number
}

/** 任务数据结构 */
export interface TaskData {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: Priority
  is_pinned: boolean | number
  start_date?: string | null
  due_date?: string | null
  completed_at?: string | null
  panel_id?: string | null
  rank?: string
  reminder_time?: string | null
  reminder_enabled?: boolean | number
  reminder_date?: string | null
  reminder_hour?: number | null
  reminder_minute?: number | null
  reminder_sent?: boolean | number
  is_recurring?: boolean | number
  recurrence_rule?: string | null
  parent_id?: string | null
  auto_generate_daily?: boolean | number
  last_generated_date?: string | null
  created_at: string
  updated_at: string
  subtasks?: SubtaskData[]
  // 兼容字段
  date?: string  // 旧版 due_date 别名
}

/** 面板数据结构 */
export interface PanelData {
  id: string
  title: string
  is_expanded?: boolean | number
  isExpanded?: boolean  // 前端使用的别名
  sort_order?: number
  width?: number
  height?: number
  copy_format?: 'text' | 'json' | 'markdown'
  copyFormat?: 'text' | 'json' | 'markdown'  // 前端别名
  copy_template_task?: string | null
  copyTemplateTask?: string | null  // 前端别名
  copy_template_subtask?: string | null
  copyTemplateSubtask?: string | null  // 前端别名
  created_at?: string
}

/** 周期任务频率类型 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'workday' | 'holiday' | 'custom'

/** 周期任务模板数据结构 */
export interface RecurringTemplateData {
  id: string
  title: string
  frequency: RecurrenceFrequency
  time: string
  reminder_time?: string | null
  reminderTime?: string | null  // 前端别名
  priority?: Priority
  enabled?: boolean | number
  last_generated?: string | null
  lastGenerated?: string | null  // 前端别名
  start_date?: string | null
  startDate?: string | null  // 前端别名
  week_days?: string | null  // JSON string
  weekDays?: number[]  // 解析后的数组
  month_days?: string | null  // JSON string
  monthDays?: number[]  // 解析后的数组
  interval_days?: number | null
  intervalDays?: number  // 前端别名
  remind_day_offsets?: string | null  // JSON string
  remindDayOffsets?: number[]  // 解析后的数组
  created_at?: string
  updated_at?: string
}

/** 番茄钟会话数据结构 */
export interface PomodoroSessionData {
  id: string
  task_id?: string | null
  start_time: string
  end_time?: string | null
  duration: number
  completed: boolean | number
}

/** 设置项类型 */
export type SettingsRecord = Record<string, unknown>

// ============= 数据库实例 =============

// 数据库实例
let db: SqlJsDatabase | null = null
let dbPath: string = ''

export async function initDatabase(): Promise<void> {
  // 获取用户数据目录
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  // 确保目录存在
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  dbPath = join(dbDir, 'zenhubboard.sqlite')

  // 初始化 sql.js
  const SQL = await initSqlJs()

  // 加载或创建数据库
  if (existsSync(dbPath)) {
    try {
      const buffer = readFileSync(dbPath)
      db = new SQL.Database(buffer)
      // 确保新表被创建
      createTables()
      saveDatabase()
    } catch (error) {
      console.error('Failed to load database, creating new one:', error)
      db = new SQL.Database()
      createTables()
      saveDatabase()
    }
  } else {
    db = new SQL.Database()
    createTables()
    initializeDefaultData() // 首次安装初始化默认数据
    saveDatabase()
  }
}

function createTables(): void {
  if (!db) return

  // 任务表 - 更新按照 ZenHubBoard_Workflow.md v2.0
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      completed_at TEXT,
      panel_id TEXT,
      rank TEXT NOT NULL DEFAULT '',
      reminder_time TEXT,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_date TEXT,
      reminder_hour INTEGER,
      reminder_minute INTEGER,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule TEXT,
      parent_id TEXT,
      auto_generate_daily INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // 迁移：添加新字段到现有表
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN panel_id TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN rank TEXT DEFAULT ''`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN completed_at TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN due_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  // 新增提醒字段迁移
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_enabled INTEGER DEFAULT 0`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_hour INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_minute INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  // 新增：记录提醒是否已发送，避免重启后重复提醒
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_sent INTEGER DEFAULT 0`)
  } catch (e) { /* 字段已存在 */ }
  // 新增：开始日期字段，支持多日任务
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN start_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  // 迁移：将现有任务的 start_date 设置为 due_date（如果 start_date 为空）
  try {
    db.run(`UPDATE tasks SET start_date = due_date WHERE start_date IS NULL AND due_date IS NOT NULL`)
  } catch (e) { /* 忽略 */ }
  // 新增：持续任务每日生成标记
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN auto_generate_daily INTEGER DEFAULT 0`)
  } catch (e) { /* 字段已存在 */ }
  // 新增：记录持续任务最后生成日期，防止删除后重生
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN last_generated_date TEXT`)
  } catch (e) { /* 字段已存在 */ }

  // 子任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'low',
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_date TEXT,
      reminder_hour INTEGER,
      reminder_minute INTEGER,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)

  // 迁移：添加子任务新字段
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN description TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN priority TEXT DEFAULT 'low'`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN reminder_enabled INTEGER DEFAULT 0`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN reminder_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN reminder_hour INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN reminder_minute INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN reminder_sent INTEGER DEFAULT 0`)
  } catch (e) { /* 字段已存在 */ }
  // 迁移：添加子任务开始/截止日期时间字段
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN start_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN start_hour INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN start_minute INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN due_date TEXT`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN due_hour INTEGER`)
  } catch (e) { /* 字段已存在 */ }
  try {
    db.run(`ALTER TABLE subtasks ADD COLUMN due_minute INTEGER`)
  } catch (e) { /* 字段已存在 */ }

  // 设置表
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // 番茄钟记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `)

  // 自定义面板表
  db.run(`
    CREATE TABLE IF NOT EXISTS panels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      is_expanded INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 360,
      height INTEGER NOT NULL DEFAULT 300,
      created_at TEXT NOT NULL
    )
  `)

  // 迁移：添加新字段到现有面板表
  try { db.run(`ALTER TABLE panels ADD COLUMN width INTEGER DEFAULT 360`) } catch (e) { /* 字段已存在 */ }
  try { db.run(`ALTER TABLE panels ADD COLUMN height INTEGER DEFAULT 300`) } catch (e) { /* 字段已存在 */ }
  // 迁移：添加复制格式字段
  try { db.run(`ALTER TABLE panels ADD COLUMN copy_format TEXT DEFAULT 'text'`) } catch (e) { /* 字段已存在 */ }
  try { db.run(`ALTER TABLE panels ADD COLUMN copy_template_task TEXT`) } catch (e) { /* 字段已存在 */ }
  try { db.run(`ALTER TABLE panels ADD COLUMN copy_template_subtask TEXT`) } catch (e) { /* 字段已存在 */ }

  // 周期任务模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      frequency TEXT NOT NULL,
      time TEXT NOT NULL,
      reminder_time TEXT,
      priority TEXT DEFAULT 'medium',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_generated TEXT,
      start_date TEXT,
      week_days TEXT,
      month_days TEXT,
      interval_days INTEGER,
      remind_day_offsets TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // 迁移：添加周期任务优先级字段
  try {
    db.run(`ALTER TABLE recurring_templates ADD COLUMN priority TEXT DEFAULT 'medium'`)
  } catch (e) { /* 字段已存在 */ }

  // AI 服务提供者表
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      model_name TEXT NOT NULL,
      system_prompt TEXT,
      temperature REAL DEFAULT 0.1,
      max_tokens INTEGER DEFAULT 1024,
      is_default INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `)

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_panels_sort ON panels(sort_order)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_recurring_enabled ON recurring_templates(enabled)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled ON ai_providers(enabled)`)

  // 初始化默认 AI 预设
  initializeDefaultAIProviders()

  // 迁移：修复旧的 Gemini 模型名
  try {
    db.run(`UPDATE ai_providers SET model_name = 'gemini-2.5-flash-latest' WHERE model_name = 'gemini-2.5-flash'`)
  } catch (e) { /* 忽略 */ }

  // 一次性迁移：将所有本周/下周任务重置到今日 (删除本周/下周面板功能)
  migrateWeekTasksToToday()
}

// 迁移：将所有未来截止日期的任务（本周/下周）重置到今日
function migrateWeekTasksToToday(): void {
  if (!db) return

  // 检查是否已执行过此迁移
  const result = db.exec(`SELECT value FROM settings WHERE key = 'migration_week_tasks_to_today'`)
  if (result.length > 0 && result[0].values.length > 0) {
    return // 已执行过，跳过
  }

  // 获取今天的日期（本地时间）
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`

  // 将所有未来日期且无 panel_id 的任务重置到今天
  try {
    db.run(`
      UPDATE tasks 
      SET due_date = ?, updated_at = ?
      WHERE panel_id IS NULL 
        AND due_date IS NOT NULL 
        AND due_date > ?
        AND status != 'done'
    `, [todayStr, new Date().toISOString(), todayStr])

    // 记录已执行迁移
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      ['migration_week_tasks_to_today', JSON.stringify({ executed: true, date: todayStr })])

    // Migration: Reset week/next-week tasks to today completed
  } catch (e) {
    console.error('[Migration] Failed to migrate week tasks:', e)
  }
}

function saveDatabase(): void {
  if (!db) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
  } catch (error) {
    console.error('Failed to save database:', error)
  }
}

// 辅助函数：将查询结果转换为对象数组
function queryToObjects(result: QueryExecResult[]): any[] {
  if (!result || result.length === 0) return []
  const columns = result[0].columns
  const values = result[0].values
  return values.map((row: any[]) => {
    const obj: Record<string, any> = {}
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i]
    })
    return obj
  })
}

// Tasks CRUD
export function getAllTasks(): TaskData[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM tasks ORDER BY created_at DESC')
  const tasks = queryToObjects(result)
  return tasks as TaskData[]
}

export function getTask(id: string): TaskData | undefined {
  if (!db) return undefined
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?')
  stmt.bind([id])
  let task: TaskData | undefined = undefined
  if (stmt.step()) {
    task = stmt.getAsObject() as TaskData
  }
  stmt.free()
  return task
}

export function createTask(task: TaskData): TaskData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, is_pinned, start_date, due_date, completed_at, panel_id, rank, reminder_time, reminder_enabled, reminder_date, reminder_hour, reminder_minute, is_recurring, recurrence_rule, parent_id, auto_generate_daily, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // start_date 默认等于 due_date（如果未指定）
  const effectiveDueDate = task.due_date || task.date || null
  const effectiveStartDate = task.start_date || effectiveDueDate
  stmt.run([
    task.id,
    task.title,
    task.description || null,
    task.status,
    task.priority,
    task.is_pinned ? 1 : 0,
    effectiveStartDate,
    effectiveDueDate,
    task.completed_at || null,
    task.panel_id || null,
    task.rank || '',
    task.reminder_time || null,
    task.reminder_enabled ? 1 : 0,
    task.reminder_date || null,
    task.reminder_hour ?? null,
    task.reminder_minute ?? null,
    task.is_recurring ? 1 : 0,
    task.recurrence_rule || null,
    task.parent_id || null,
    task.auto_generate_daily ? 1 : 0,
    task.created_at,
    task.updated_at
  ])
  stmt.free()
  saveDatabase()

  // 如果设置了每日生成，立即检查并生成
  if (task.auto_generate_daily) {
    try {
      checkAndGenerateContinuousTasks(task.id)
    } catch (e) {
      console.error('[DB] Failed to auto-generate daily task on create:', e)
    }
  }

  return task
}

export function updateTask(task: TaskData): TaskData {
  if (!db) throw new Error('Database not initialized')

  // Check previous state of auto_generate_daily
  const checkOldStmt = db.prepare('SELECT auto_generate_daily FROM tasks WHERE id = :id')
  checkOldStmt.bind([task.id])
  const hasOld = checkOldStmt.step()
  const oldTask = hasOld ? checkOldStmt.getAsObject() : undefined
  checkOldStmt.free()
  // auto_generate_daily might be returned as number 1/0
  const wasAutoGenerate = oldTask?.auto_generate_daily === 1

  const stmt = db.prepare(`
    UPDATE tasks SET 
      title = ?, description = ?, status = ?, priority = ?, is_pinned = ?, 
      start_date = ?, due_date = ?, completed_at = ?, panel_id = ?, rank = ?,
      reminder_time = ?, reminder_enabled = ?, reminder_date = ?, reminder_hour = ?, reminder_minute = ?,
      reminder_sent = ?,
      is_recurring = ?, recurrence_rule = ?, 
      parent_id = ?, auto_generate_daily = ?, updated_at = ?
    WHERE id = ?
  `)
  // start_date 默认等于 due_date（如果未指定）
  const effectiveDueDate = task.due_date || task.date || null
  const effectiveStartDate = task.start_date !== undefined ? task.start_date : effectiveDueDate
  stmt.run([
    task.title,
    task.description || null,
    task.status,
    task.priority,
    task.is_pinned ? 1 : 0,
    effectiveStartDate,
    effectiveDueDate,
    task.completed_at || null,
    task.panel_id || null,
    task.rank || '',
    task.reminder_time || null,
    task.reminder_enabled ? 1 : 0,
    task.reminder_date || null,
    task.reminder_hour ?? null,
    task.reminder_minute ?? null,
    task.reminder_sent ? 1 : 0,
    task.is_recurring ? 1 : 0,
    task.recurrence_rule || null,
    task.parent_id || null,
    task.auto_generate_daily ? 1 : 0,
    task.updated_at,
    task.id
  ])
  stmt.free()
  saveDatabase()

  // Sync Completion for Continuous Task
  if (task.status === 'done' && task.parent_id) {
    try {
      const parentStmt = db.prepare('SELECT id, due_date FROM tasks WHERE id = ?')
      parentStmt.bind([task.parent_id])
      if (parentStmt.step()) {
        const parent = parentStmt.getAsObject()
        // Check if the generated task matches the parent's due date (Last day of continuous task)
        // Adjust logic: If parent has due_date, and current task due_date equals or is after it (shouldn't be after)
        // Note: generated daily task usually has due_date = today.
        if (parent.due_date && task.due_date === parent.due_date) {
          console.log('[DB] Completing parent continuous task as last instance is done')
          db.run("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?", [task.updated_at, parent.id])
        }
      }
      parentStmt.free()
    } catch (e) {
      console.error('[DB] Failed to sync continuous task completion:', e)
    }
  }

  // 验证更新是否成功 (check only for errors)
  const verifyStmt = db.prepare('SELECT id, due_date, panel_id FROM tasks WHERE id = ?')
  verifyStmt.bind([task.id])
  if (!verifyStmt.step()) {
    console.error('[DB] updateTask FAILED - task not found after update:', task.id)
  }
  verifyStmt.free()

  // Only generate if toggled from OFF to ON
  if (!wasAutoGenerate && task.auto_generate_daily) {
    try {
      checkAndGenerateContinuousTasks(task.id)
    } catch (e) {
      console.error('[DB] Failed to auto-generate daily task on update:', e)
    }
  }

  return task
}

export function deleteTask(id: string): boolean {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM subtasks WHERE task_id = ?', [id])
  db.run('DELETE FROM tasks WHERE id = ?', [id])
  saveDatabase()
  return true
}

// Subtasks CRUD
export function getSubtasks(taskId: string): SubtaskData[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order', [taskId])
  return queryToObjects(result) as SubtaskData[]
}

export function getAllSubtasks(): SubtaskData[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM subtasks ORDER BY sort_order')
  return queryToObjects(result) as SubtaskData[]
}

export function createSubtask(subtask: SubtaskData): SubtaskData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO subtasks (id, task_id, title, description, priority, completed, sort_order, 
    start_date, start_hour, start_minute, due_date, due_hour, due_minute,
    reminder_enabled, reminder_date, reminder_hour, reminder_minute, reminder_sent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run([
    subtask.id,
    subtask.task_id,
    subtask.title,
    subtask.description || null,
    subtask.priority || 'low',
    subtask.completed ? 1 : 0,
    subtask.order || 0,
    subtask.start_date || null,
    subtask.start_hour ?? null,
    subtask.start_minute ?? null,
    subtask.due_date || null,
    subtask.due_hour ?? null,
    subtask.due_minute ?? null,
    subtask.reminder_enabled ? 1 : 0,
    subtask.reminder_date || null,
    subtask.reminder_hour ?? null,
    subtask.reminder_minute ?? null,
    0
  ])
  stmt.free()
  saveDatabase()
  return subtask
}

export function updateSubtask(subtask: SubtaskData): SubtaskData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    UPDATE subtasks SET title = ?, description = ?, priority = ?, completed = ?, sort_order = ?,
    start_date = ?, start_hour = ?, start_minute = ?, due_date = ?, due_hour = ?, due_minute = ?,
    reminder_enabled = ?, reminder_date = ?, reminder_hour = ?, reminder_minute = ?, reminder_sent = ?
    WHERE id = ?
  `)
  stmt.run([
    subtask.title,
    subtask.description || null,
    subtask.priority || 'low',
    subtask.completed ? 1 : 0,
    subtask.order || 0,
    subtask.start_date || null,
    subtask.start_hour ?? null,
    subtask.start_minute ?? null,
    subtask.due_date || null,
    subtask.due_hour ?? null,
    subtask.due_minute ?? null,
    subtask.reminder_enabled ? 1 : 0,
    subtask.reminder_date || null,
    subtask.reminder_hour ?? null,
    subtask.reminder_minute ?? null,
    (subtask.reminder_sent ?? false) ? 1 : 0,
    subtask.id
  ])
  stmt.free()
  saveDatabase()
  return subtask
}

export function deleteSubtask(id: string): boolean {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM subtasks WHERE id = ?', [id])
  saveDatabase()
  return true
}

// Settings
export function getSettings(): SettingsRecord {
  if (!db) return {}
  const result = db.exec('SELECT * FROM settings')
  const rows = queryToObjects(result)
  const settings: SettingsRecord = {}
  rows.forEach((row: any) => {
    try {
      settings[row.key] = JSON.parse(row.value)
    } catch {
      settings[row.key] = row.value
    }
  })
  return settings
}

export function setSetting(key: string, value: unknown): boolean {
  if (!db) throw new Error('Database not initialized')
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)])
  saveDatabase()
  return true
}

// Pomodoro Sessions
export function createPomodoroSession(session: PomodoroSessionData): PomodoroSessionData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    INSERT INTO pomodoro_sessions (id, task_id, start_time, end_time, duration, completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run([session.id, session.task_id || null, session.start_time, session.end_time || null, session.duration, session.completed ? 1 : 0])
  stmt.free()
  saveDatabase()
  return session
}

export function updatePomodoroSession(session: PomodoroSessionData): PomodoroSessionData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    UPDATE pomodoro_sessions SET task_id = ?, start_time = ?, end_time = ?, duration = ?, completed = ?
    WHERE id = ?
  `)
  stmt.run([session.task_id || null, session.start_time, session.end_time || null, session.duration, session.completed ? 1 : 0, session.id])
  stmt.free()
  saveDatabase()
  return session
}

// Custom Panels
export function getAllPanels(): PanelData[] {
  if (!db) throw new Error('Database not initialized')
  const result = db.exec(`SELECT * FROM panels ORDER BY sort_order ASC`)
  const panels = queryToObjects(result)
  return panels.map((p: PanelData) => ({
    ...p,
    is_expanded: Boolean(p.is_expanded),
    isExpanded: Boolean(p.is_expanded),
    copyFormat: p.copy_format || 'text',
    copyTemplateTask: p.copy_template_task || null,
    copyTemplateSubtask: p.copy_template_subtask || null
  })) as PanelData[]
}

export function createPanel(panel: PanelData): PanelData {
  if (!db) throw new Error('Database not initialized')
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO panels (id, title, is_expanded, sort_order, width, height, copy_format, copy_template_task, copy_template_subtask, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run([
    panel.id,
    panel.title,
    panel.isExpanded ? 1 : 0,
    panel.sort_order || 0,
    panel.width || 360,
    panel.height || 300,
    panel.copyFormat || 'text',
    panel.copyTemplateTask || null,
    panel.copyTemplateSubtask || null,
    now
  ])
  stmt.free()
  saveDatabase()
  return {
    ...panel,
    created_at: now,
    isExpanded: panel.isExpanded ?? true,
    width: panel.width || 360,
    height: panel.height || 300,
    copyFormat: panel.copyFormat || 'text',
    copyTemplateTask: panel.copyTemplateTask || null,
    copyTemplateSubtask: panel.copyTemplateSubtask || null
  }
}

export function updatePanel(panel: PanelData): PanelData {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(`
    UPDATE panels SET title = ?, is_expanded = ?, sort_order = ?, width = ?, height = ?,
    copy_format = ?, copy_template_task = ?, copy_template_subtask = ? WHERE id = ?
  `)
  stmt.run([
    panel.title,
    panel.isExpanded ? 1 : 0,
    panel.sort_order || 0,
    panel.width || 360,
    panel.height || 300,
    panel.copyFormat || 'text',
    panel.copyTemplateTask || null,
    panel.copyTemplateSubtask || null,
    panel.id
  ])
  stmt.free()
  saveDatabase()
  return panel
}

export function deletePanel(id: string): boolean {
  if (!db) throw new Error('Database not initialized')
  // 删除属于该面板的任务的子任务 (防止孤儿数据)
  db.run(`DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE panel_id = ?)`, [id])
  // 删除属于该面板的任务
  db.run(`DELETE FROM tasks WHERE panel_id = ?`, [id])
  // 删除面板本身
  db.run(`DELETE FROM panels WHERE id = ?`, [id])
  saveDatabase()
  return true
}

// ============= 周期任务模板 CRUD =============

export function getAllRecurringTemplates(): RecurringTemplateData[] {
  if (!db) throw new Error('Database not initialized')
  const result = db.exec(`SELECT * FROM recurring_templates ORDER BY created_at DESC`)
  const templates = queryToObjects(result)
  return templates.map((t: RecurringTemplateData) => ({
    ...t,
    enabled: Boolean(t.enabled),
    priority: t.priority || 'medium',
    weekDays: t.week_days ? JSON.parse(t.week_days) : undefined,
    monthDays: t.month_days ? JSON.parse(t.month_days) : undefined,
    intervalDays: t.interval_days,
    remindDayOffsets: t.remind_day_offsets ? JSON.parse(t.remind_day_offsets) : undefined,
    reminderTime: t.reminder_time,
    lastGenerated: t.last_generated,
    startDate: t.start_date
  })) as RecurringTemplateData[]
}

export function createRecurringTemplate(template: RecurringTemplateData): RecurringTemplateData {
  if (!db) throw new Error('Database not initialized')
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO recurring_templates (id, title, frequency, time, reminder_time, priority, enabled, last_generated, start_date, week_days, month_days, interval_days, remind_day_offsets, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run([
    template.id,
    template.title,
    template.frequency,
    template.time,
    template.reminderTime || null,
    template.priority || 'medium',
    template.enabled !== false ? 1 : 0, // 使用传入的 enabled 值
    template.lastGenerated || null,
    template.startDate || null,
    template.weekDays ? JSON.stringify(template.weekDays) : null,
    template.monthDays ? JSON.stringify(template.monthDays) : null,
    template.intervalDays || null,
    template.remindDayOffsets ? JSON.stringify(template.remindDayOffsets) : null,
    now,
    now
  ])
  stmt.free()
  saveDatabase()
  return { ...template, created_at: now, updated_at: now }
}

export function updateRecurringTemplate(template: RecurringTemplateData): RecurringTemplateData {
  if (!db) throw new Error('Database not initialized')
  const now = new Date()
  const nowIso = now.toISOString()

  // 获取当前模板的旧数据，检查时间是否变更
  const oldResult = db.exec(`SELECT time, last_generated FROM recurring_templates WHERE id = '${template.id.replace(/'/g, "''")}'`)
  const oldData = oldResult.length > 0 && oldResult[0].values.length > 0 ? oldResult[0].values[0] : null
  const oldTime = oldData ? oldData[0] as string | null : null
  const oldLastGenerated = oldData ? oldData[1] as string | null : null

  // 确定 last_generated 的值
  let effectiveLastGenerated = template.lastGenerated || null

  // 如果时间被修改到更晚的时间，检查是否需要重置 last_generated
  if (template.time && template.time !== oldTime && oldLastGenerated) {
    // 获取今天的日期字符串
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    // 如果今天已经生成过任务
    if (oldLastGenerated === todayStr) {
      // 检查新时间是否在当前时间之后
      const [newHour, newMinute] = template.time.split(':').map(Number)
      const currentTimeVal = now.getHours() * 60 + now.getMinutes()
      const newTimeVal = newHour * 60 + newMinute

      // 如果新时间大于当前时间，重置 last_generated 以允许今天再次生成
      if (newTimeVal > currentTimeVal) {
        effectiveLastGenerated = null
      }
    }
  }

  const stmt = db.prepare(`
    UPDATE recurring_templates SET 
      title = ?, frequency = ?, time = ?, reminder_time = ?, priority = ?, enabled = ?,
      last_generated = ?, start_date = ?, week_days = ?, month_days = ?,
      interval_days = ?, remind_day_offsets = ?, updated_at = ?
    WHERE id = ?
  `)
  stmt.run([
    template.title,
    template.frequency,
    template.time,
    template.reminderTime || null,
    template.priority || 'medium',
    template.enabled !== false ? 1 : 0,
    effectiveLastGenerated,
    template.startDate || null,
    template.weekDays ? JSON.stringify(template.weekDays) : null,
    template.monthDays ? JSON.stringify(template.monthDays) : null,
    template.intervalDays || null,
    template.remindDayOffsets ? JSON.stringify(template.remindDayOffsets) : null,
    nowIso,
    template.id
  ])
  stmt.free()
  saveDatabase()
  return { ...template, updated_at: nowIso }
}

export function deleteRecurringTemplate(id: string): boolean {
  if (!db) throw new Error('Database not initialized')
  db.run(`DELETE FROM recurring_templates WHERE id = ?`, [id])
  saveDatabase()
  return true
}

// ============= 周期任务调度器 =============

// 预解析后的模板接口，避免在 shouldGenerateTask 中重复解析 JSON
interface ParsedTemplate {
  id: string
  title: string
  frequency: string
  time?: string
  reminder_time?: string
  priority?: string
  last_generated?: string
  start_date?: string
  interval_days?: number
  // 预解析的 JSON 字段
  weekDays: number[]
  monthDays: number[]
  remindDayOffsets: number[]
}

// 将原始模板数据解析为 ParsedTemplate，在调度器中复用
function parseTemplate(raw: any): ParsedTemplate {
  return {
    ...raw,
    weekDays: raw.week_days ? JSON.parse(raw.week_days) : [],
    monthDays: raw.month_days ? JSON.parse(raw.month_days) : [],
    remindDayOffsets: raw.remind_day_offsets ? JSON.parse(raw.remind_day_offsets) : []
  }
}

function shouldGenerateTask(template: ParsedTemplate, today: Date, todayStr: string): boolean {
  const frequency = template.frequency
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay() // 1=Mon, 7=Sun
  const dayOfMonth = today.getDate()
  const monthOfYear = today.getMonth() + 1 // 1-12

  switch (frequency) {
    case 'daily':
      return true

    case 'weekly':
      // 使用预解析的 weekDays，无需再次 JSON.parse
      return template.weekDays.includes(dayOfWeek)

    case 'monthly':
      // 使用预解析的 monthDays，无需再次 JSON.parse
      return template.monthDays.includes(dayOfMonth)

    case 'yearly':
      // 使用 start_date 作为每年生成的日期参考 (月和日)
      if (!template.start_date) return false
      const startDate = new Date(template.start_date)
      const startMonth = startDate.getMonth() + 1 // 1-12
      const startDay = startDate.getDate()
      return monthOfYear === startMonth && dayOfMonth === startDay

    case 'workday':
      // 使用真实节假日日历判断工作日
      try {
        const { isRealWorkday } = require('./holidayService')
        return isRealWorkday(todayStr)
      } catch {
        // 回退到简单判断
        return dayOfWeek >= 1 && dayOfWeek <= 5
      }

    case 'holiday':
      // 使用真实节假日日历判断休息日
      try {
        const { isRealHoliday } = require('./holidayService')
        return isRealHoliday(todayStr)
      } catch {
        // 回退到简单判断
        return dayOfWeek === 6 || dayOfWeek === 7
      }

    case 'custom':
      if (!template.start_date || !template.interval_days) return false
      const customStartDate = new Date(template.start_date)
      const diffTime = today.getTime() - customStartDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays < 0) return false
      const currentOffset = (diffDays % template.interval_days) + 1
      // 使用预解析的 remindDayOffsets，无需再次 JSON.parse
      return template.remindDayOffsets.includes(currentOffset)

    default:
      return false
  }
}

export function checkAndGenerateRecurringTasks(): { generated: number; templates: string[] } {
  if (!db) throw new Error('Database not initialized')

  const today = new Date()
  // Use local time for date string to match user's wall clock and getDay()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}` // YYYY-MM-DD (Local)

  // Get all enabled templates and pre-parse JSON fields once
  const result = db.exec(`SELECT * FROM recurring_templates WHERE enabled = 1`)
  const rawTemplates = queryToObjects(result)
  const templates = rawTemplates.map(parseTemplate) // 预解析所有 JSON 字段

  const generated: string[] = []

  for (const template of templates) {
    // Check if already generated today
    if (template.last_generated === todayStr) {
      continue
    }

    // Check if should generate based on frequency rules
    if (!shouldGenerateTask(template, today, todayStr)) {
      continue
    }

    // Check if time has arrived
    if (template.time) {
      const now = new Date()
      const currentHours = now.getHours()
      const currentMinutes = now.getMinutes()
      const [targetHours, targetMinutes] = template.time.split(':').map(Number)

      const currentTimeValue = currentHours * 60 + currentMinutes
      const targetTimeValue = targetHours * 60 + targetMinutes

      if (currentTimeValue < targetTimeValue) {
        continue
      }
    }

    // 防止午夜边界重复生成：检查今天是否已存在该模板生成的任务
    const existingTaskCheck = db.exec(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE title = '${template.title.replace(/'/g, "''")}' 
         AND description LIKE '周期任务自动生成%'
         AND DATE(created_at) = '${todayStr}'`
    )
    if (existingTaskCheck.length > 0 && existingTaskCheck[0].values[0][0] > 0) {
      // 任务已存在，更新 last_generated 以保持同步
      const syncStmt = db.prepare(`UPDATE recurring_templates SET last_generated = ? WHERE id = ?`)
      syncStmt.run([todayStr, template.id])
      syncStmt.free()
      saveDatabase()
      continue
    }

    // Parse reminder time if enabled
    let rDate = null
    let rHour = null
    let rMinute = null

    if (template.reminder_time) {
      rDate = todayStr
      const [h, m] = template.reminder_time.split(':').map(Number)
      rHour = h
      rMinute = m
    }

    // 解析模板时间作为任务开始/结束时间
    let taskStartDate = todayStr
    let taskDueDate = todayStr
    if (template.time) {
      const [h, m] = template.time.split(':').map(Number)
      taskStartDate = `${todayStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
      // 结束时间默认等于开始时间 (周期任务通常是当天完成)
      taskDueDate = taskStartDate
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    // 检查是否需要立即发送提醒（提醒时间已到）
    let shouldSendImmediate = false
    if (template.reminder_time && rDate && rHour !== null && rMinute !== null) {
      const currentH = new Date().getHours()
      const currentM = new Date().getMinutes()
      const currentTimeVal = currentH * 60 + currentM
      const reminderTimeVal = rHour * 60 + rMinute
      shouldSendImmediate = currentTimeVal >= reminderTimeVal
    }

    const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, is_pinned, start_date, due_date, 
        reminder_time, reminder_enabled, reminder_date, reminder_hour, reminder_minute,
        reminder_sent, created_at, updated_at, rank
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run([
      taskId,
      template.title,
      `周期任务自动生成 - ${template.frequency}`,
      'todo',
      template.priority || 'medium',
      0,
      taskStartDate,
      taskDueDate,
      template.reminder_time || null,
      template.reminder_time ? 1 : 0,
      rDate,
      rHour,
      rMinute,
      shouldSendImmediate ? 1 : 0, // 如果立即发送，标记为已发送
      now,
      now,
      ''
    ])
    stmt.free()

    // Update last_generated and immediately save to prevent race conditions
    const updateStmt = db.prepare(`UPDATE recurring_templates SET last_generated = ? WHERE id = ?`)
    updateStmt.run([todayStr, template.id])
    updateStmt.free()
    saveDatabase() // 立即保存，防止竞态条件

    // 如果需要立即发送提醒
    if (shouldSendImmediate) {
      import('./reminder').then(({ sendNotification }) => {
        const timeStr = `${String(rHour).padStart(2, '0')}:${String(rMinute).padStart(2, '0')}`
        sendNotification(template.title, `任务提醒时间到了！(${rDate} ${timeStr})`)
      }).catch(err => console.error('Failed to send immediate reminder:', err))
    }

    generated.push(template.title)
  }

  return { generated: generated.length, templates: generated }
}

export function checkAndGenerateContinuousTasks(targetTaskId?: string): { generated: number; tasks: string[] } {
  if (!db) throw new Error('Database not initialized')

  // Use local time for calculation explicitly
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`

  /* 
     Fix: Compare against end of today for start_date because start_date stores time (YYYY-MM-DDTHH:mm:ss).
     '2025-12-28T09:00:00' > '2025-12-28', causing start_date <= todayStr to fail.
  */
  const endOfTodayStr = `${todayStr}T23:59:59`

  console.log('[Scheduler] checking continuous tasks. Today range:', todayStr, 'to', endOfTodayStr, 'targetTaskId:', targetTaskId)

  // 使用参数化查询获取符合条件的持续任务
  const queryContinuousTasks = (taskId?: string) => {
    if (taskId) {
      // 查询特定任务
      const stmt = db!.prepare(`
        SELECT * FROM tasks 
        WHERE auto_generate_daily = 1 
          AND status != 'done' 
          AND start_date <= ? 
          AND due_date >= ?
          AND (last_generated_date IS NULL OR last_generated_date != ?)
          AND id = ?
      `)
      stmt.bind([endOfTodayStr, todayStr, todayStr, taskId])
      const results: any[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    } else {
      // 查询所有符合条件的任务
      const stmt = db!.prepare(`
        SELECT * FROM tasks 
        WHERE auto_generate_daily = 1 
          AND status != 'done' 
          AND start_date <= ? 
          AND due_date >= ?
          AND (last_generated_date IS NULL OR last_generated_date != ?)
      `)
      stmt.bind([endOfTodayStr, todayStr, todayStr])
      const results: any[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    }
  }

  const continuousTasks = queryContinuousTasks(targetTaskId)
  console.log('[Scheduler] Found continuous tasks eligible:', continuousTasks.length, continuousTasks.map((t: any) => t.title))

  const generated: string[] = []

  for (const parentTask of continuousTasks) {
    // Generate daily instance
    const taskId = `task-daily-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, is_pinned, start_date, due_date,
        panel_id, rank, parent_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run([
      taskId,
      `${parentTask.title} ${month}.${day}`,
      (parentTask.description || '') + '\n\n[自动任务]',
      'todo',
      parentTask.priority,
      0, // Don't inherit pin status usually
      todayStr,
      todayStr, // It's a single day task for today
      null, // Put in Today panel (null panel_id means Inbox/Today)
      '',
      parentTask.id, // Link to parent
      now,
      now
    ])
    stmt.free()

    // 获取父任务的子任务，并根据日期过滤 (使用参数化查询)
    const subtaskStmt = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order')
    subtaskStmt.bind([parentTask.id])
    const parentSubtasks: SubtaskData[] = []
    while (subtaskStmt.step()) {
      parentSubtasks.push(subtaskStmt.getAsObject() as SubtaskData)
    }
    subtaskStmt.free()

    let copiedSubtaskCount = 0
    for (const st of parentSubtasks) {
      // 检查子任务是否应该在今天复制
      // 规则：如果子任务没有设置日期，则默认复制；如果设置了日期，则只有当 start_date <= 今天 <= due_date 时才复制
      let shouldCopySubtask = true

      if (st.start_date || st.due_date) {
        const stStart = st.start_date?.split('T')[0]
        const stDue = st.due_date?.split('T')[0]

        // 如果有开始日期，检查今天是否 >= 开始日期
        if (stStart && todayStr < stStart) {
          shouldCopySubtask = false
        }
        // 如果有截止日期，检查今天是否 <= 截止日期
        if (stDue && todayStr > stDue) {
          shouldCopySubtask = false
        }
      }

      if (shouldCopySubtask) {
        const subtaskId = `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const stStmt = db.prepare(`
          INSERT INTO subtasks (id, task_id, title, description, priority, completed, sort_order,
            start_date, start_hour, start_minute, due_date, due_hour, due_minute,
            reminder_enabled, reminder_date, reminder_hour, reminder_minute, reminder_sent)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        stStmt.run([
          subtaskId,
          taskId,
          st.title,
          st.description || null,
          st.priority || 'low',
          st.order || 0,
          null, // 每日任务的子任务不需要独立日期
          null,
          null,
          null,
          null,
          null,
          st.reminder_enabled ? 1 : 0,
          st.reminder_enabled ? todayStr : null, // 如果有提醒，设置为今天
          st.reminder_hour ?? null,
          st.reminder_minute ?? null
        ])
        stStmt.free()
        copiedSubtaskCount++
      }
    }

    if (copiedSubtaskCount > 0) {
      console.log(`[Scheduler] Copied ${copiedSubtaskCount}/${parentSubtasks.length} subtasks for daily task "${parentTask.title}"`)
    }

    // Update parent's last_generated_date
    const updateStmt = db.prepare('UPDATE tasks SET last_generated_date = ? WHERE id = ?')
    updateStmt.run([todayStr, parentTask.id])
    updateStmt.free()

    generated.push(parentTask.title)
  }

  if (generated.length > 0) {
    saveDatabase()
    console.log(`[Scheduler] Generated ${generated.length} daily continuous tasks:`, generated)
  }

  return { generated: generated.length, tasks: generated }
}

// ============= 首次安装数据初始化 =============

import { DEFAULT_SETTINGS, DEFAULT_PANELS, DEFAULT_RECURRING, INTRO_TASKS } from './defaultData'

function initializeDefaultData(): void {
  if (!db) return

  const now = new Date().toISOString()
  // Use local date for 'today' calculation to avoid timezone issues (e.g. UTC yesterday being Local today)
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  const localISOTime = (new Date(d.getTime() - offset)).toISOString()
  const today = localISOTime.split('T')[0]

  console.log('[InitData] Initializing default data with User Defaults...')

  // 1. 创建默认自定义面板 (From DEFAULT_PANELS)
  for (const panel of DEFAULT_PANELS) {
    const stmt = db.prepare(`
      INSERT INTO panels (id, title, is_expanded, sort_order, width, height, copy_format, copy_template_task, copy_template_subtask, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // 处理提取的数据中可能缺少的字段，给予默认值
    stmt.run([
      panel.id,
      panel.title,
      panel.is_expanded ? 1 : 0,
      panel.sort_order || 0,
      panel.width || 360,
      panel.height || 300,
      panel.copy_format || 'text',
      panel.copy_template_task || null,
      panel.copy_template_subtask || null,
      now
    ])
    stmt.free()
  }
  console.log('[InitData] Created default panels:', DEFAULT_PANELS.map((p: any) => p.title))

  // 2. 创建引导任务 (Intro Tasks)
  for (const task of INTRO_TASKS) {
    const stmt = db.prepare(`
        INSERT INTO tasks (id, title, description, status, priority, is_pinned, due_date, panel_id, rank, created_at, updated_at)
        VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, '', ?, ?)
    `)
    // Replace 'TODAY' with actual date
    const dueDate = task.due_date === 'TODAY' ? today : task.due_date;

    stmt.run([
      task.id,
      task.title,
      task.description || null,
      task.priority || 'medium',
      task.is_pinned ? 1 : 0,
      dueDate,
      null, // Init tasks go to Inbox/Today
      now,
      now
    ])
    stmt.free()
  }
  console.log('[InitData] Created intro tasks:', INTRO_TASKS.length)

  // 3. 创建默认周期任务模板 (From DEFAULT_RECURRING)
  for (const template of DEFAULT_RECURRING) {
    const stmt = db.prepare(`
      INSERT INTO recurring_templates (id, title, frequency, time, reminder_time, priority, enabled, week_days, month_days, remind_day_offsets, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run([
      template.id,
      template.title,
      template.frequency,
      template.time,
      template.reminder_time || null,
      template.priority || 'medium',
      template.enabled ? 1 : 0,
      template.week_days ? JSON.stringify(template.week_days) : null,
      template.month_days ? JSON.stringify(template.month_days) : null,
      template.remind_day_offsets ? JSON.stringify(template.remind_day_offsets) : null,
      now,
      now
    ])
    stmt.free()
  }
  console.log('[InitData] Created default recurring templates:', DEFAULT_RECURRING.length)

  // 4. 创建默认设置 (From DEFAULT_SETTINGS)
  // 遍历 DEFAULT_SETTINGS 对象并插入
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    // 如果 value 是对象/数组，转换为 JSON 字符串；如果是字符串/数字/布尔值，保持原样(但DB value是TEXT)
    let dbValue = value;
    if (typeof value === 'object' && value !== null) {
      dbValue = JSON.stringify(value);
    } else {
      dbValue = String(value);
    }
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, dbValue])
  }
  console.log('[InitData] Created default settings')

  console.log('[InitData] Default data initialization complete!')
}

// ============= AI Provider 初始化和 CRUD =============

import { encryptApiKey, decryptApiKey } from './utils/crypto'

// 辅助函数：计算相对日期
function calculateDate(base: Date, addDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + addDays)
  // Use local date methods
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 基础系统提示词模板（不含日期，用于用户编辑展示）
 */
export const BASE_SYSTEM_PROMPT = `你是一个待办任务解析助手。请将用户的自然语言描述解析为结构化JSON，字段包含：title(任务标题,必填)、description(描述)、dueDate(截止日期YYYY-MM-DD)、dueTime(截止时间HH:mm)、startDate(开始日期,用于跨天任务)、hasReminder(是否提醒)、reminderAdvanceMinutes(提前提醒分钟数,默认0)、priority(优先级low/medium/high,默认medium)、tags(标签数组)、panelKeyword(任务卡片名称关键词如工作/学习/项目A等用户自定义的任务分组信息)、isPinned(是否置顶)。仅输出JSON，无其他内容。`

/**
 * 生成动态系统提示词（注入当前时间）
 * 在发送给AI时调用，自动附加当前日期信息
 */
export function getSystemPrompt(currentDate: Date = new Date()): string {
  // Use local date methods for prompt context
  const year = currentDate.getFullYear()
  const month = String(currentDate.getMonth() + 1).padStart(2, '0')
  const day = String(currentDate.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  const timeStr = currentDate.toTimeString().slice(0, 5)
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][currentDate.getDay()]

  return `${BASE_SYSTEM_PROMPT}当前日期:${dateStr}(周${weekDay}) ${timeStr}。`
}

// 兼容旧代码的默认提示词（静态版本）
export const DEFAULT_SYSTEM_PROMPT = getSystemPrompt()

function initializeDefaultAIProviders(): void {
  if (!db) return

  // 检查是否已有预设
  const result = db.exec(`SELECT COUNT(*) as count FROM ai_providers`)
  if (result.length > 0 && result[0].values[0][0] as number > 0) {
    return // 已有数据，不重复初始化
  }

  const now = new Date().toISOString()

  const defaultProviders = [
    {
      id: 'gemini-default',
      type: 'gemini',
      name: 'Google Gemini',
      enabled: 1,
      base_url: 'https://generativelanguage.googleapis.com/v1beta/models/',
      api_key_encrypted: '',
      model_name: 'gemini-2.5-flash-latest',
      system_prompt: null,
      temperature: 0.1,
      max_tokens: 1024,
      is_default: 1
    },
    {
      id: 'ollama-default',
      type: 'openai_compatible',
      name: 'Ollama (本地)',
      enabled: 1,
      base_url: 'http://localhost:11434/v1',
      api_key_encrypted: '',
      model_name: 'llama3',
      system_prompt: null,
      temperature: 0.1,
      max_tokens: 1024,
      is_default: 0
    },
    {
      id: 'deepseek-default',
      type: 'openai_compatible',
      name: 'DeepSeek',
      enabled: 1,
      base_url: 'https://api.deepseek.com/v1',
      api_key_encrypted: '',
      model_name: 'deepseek-chat',
      system_prompt: null,
      temperature: 0.1,
      max_tokens: 1024,
      is_default: 0
    }
  ]

  for (const provider of defaultProviders) {
    const stmt = db.prepare(`
      INSERT INTO ai_providers(id, type, name, enabled, base_url, api_key_encrypted, model_name, system_prompt, temperature, max_tokens, is_default, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    stmt.run([
      provider.id,
      provider.type,
      provider.name,
      provider.enabled,
      provider.base_url,
      provider.api_key_encrypted,
      provider.model_name,
      provider.system_prompt,
      provider.temperature,
      provider.max_tokens,
      provider.is_default,
      now,
      now
    ])
    stmt.free()
  }
  console.log('[InitData] Created default AI providers:', defaultProviders.length)
}

// ============= AI Provider CRUD =============

export interface AIProviderConfig {
  id: string
  type: 'gemini' | 'openai_compatible'
  name: string
  enabled: boolean
  baseUrl: string
  apiKey?: string
  modelName: string
  systemPrompt?: string
  temperature: number
  maxTokens: number
  isDefault: boolean
}

export function getAllAIProviders(): AIProviderConfig[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM ai_providers ORDER BY is_default DESC, name ASC')
  const rows = queryToObjects(result)
  return rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: Boolean(row.enabled),
    baseUrl: row.base_url,
    apiKey: row.api_key_encrypted ? decryptApiKey(row.api_key_encrypted) : '',
    modelName: row.model_name,
    systemPrompt: row.system_prompt,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    isDefault: Boolean(row.is_default)
  }))
}

export function getAIProvider(id: string): AIProviderConfig | undefined {
  if (!db) return undefined
  const stmt = db.prepare('SELECT * FROM ai_providers WHERE id = ?')
  stmt.bind([id])
  let provider = undefined
  if (stmt.step()) {
    const row = stmt.getAsObject() as any
    provider = {
      id: row.id,
      type: row.type,
      name: row.name,
      enabled: Boolean(row.enabled),
      baseUrl: row.base_url,
      apiKey: row.api_key_encrypted ? decryptApiKey(row.api_key_encrypted) : '',
      modelName: row.model_name,
      systemPrompt: row.system_prompt,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      isDefault: Boolean(row.is_default)
    }
  }
  stmt.free()
  return provider
}

export function getActiveAIProvider(): AIProviderConfig | undefined {
  const settings = getSettings()
  const activeId = settings.capsule_active_provider_id as string | undefined
  if (activeId) {
    return getAIProvider(activeId)
  }
  // 返回默认 provider
  const providers = getAllAIProviders()
  return providers.find(p => p.isDefault) || providers[0]
}

export function saveAIProvider(provider: AIProviderConfig): AIProviderConfig {
  if (!db) throw new Error('Database not initialized')

  const now = new Date().toISOString()
  const encryptedKey = provider.apiKey ? encryptApiKey(provider.apiKey) : ''

  // Check if exists
  const existing = getAIProvider(provider.id)

  if (existing) {
    // Update
    const stmt = db.prepare(`
      UPDATE ai_providers SET
type = ?, name = ?, enabled = ?, base_url = ?, api_key_encrypted = ?,
  model_name = ?, system_prompt = ?, temperature = ?, max_tokens = ?,
  is_default = ?, updated_at = ?
    WHERE id = ?
      `)
    stmt.run([
      provider.type,
      provider.name,
      provider.enabled ? 1 : 0,
      provider.baseUrl,
      encryptedKey,
      provider.modelName,
      provider.systemPrompt || null,
      provider.temperature,
      provider.maxTokens,
      provider.isDefault ? 1 : 0,
      now,
      provider.id
    ])
    stmt.free()
  } else {
    // Insert
    const stmt = db.prepare(`
      INSERT INTO ai_providers(id, type, name, enabled, base_url, api_key_encrypted, model_name, system_prompt, temperature, max_tokens, is_default, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    stmt.run([
      provider.id,
      provider.type,
      provider.name,
      provider.enabled ? 1 : 0,
      provider.baseUrl,
      encryptedKey,
      provider.modelName,
      provider.systemPrompt || null,
      provider.temperature,
      provider.maxTokens,
      provider.isDefault ? 1 : 0,
      now,
      now
    ])
    stmt.free()
  }

  saveDatabase()
  return provider
}

export function deleteAIProvider(id: string): boolean {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM ai_providers WHERE id = ?', [id])
  saveDatabase()
  return true
}

export function setActiveAIProvider(id: string): boolean {
  return setSetting('capsule_active_provider_id', id)
}

export function getCapsuleSettings(): { useAI: boolean; activeProviderId: string; systemPrompt: string } {
  const settings = getSettings()
  return {
    useAI: Boolean(settings.capsule_use_ai),
    activeProviderId: (settings.capsule_active_provider_id as string) || '',
    systemPrompt: (settings.capsule_system_prompt as string) || '' // Remove default fallback to ensure dynamic generation in AI service
  }
}

export function saveCapsuleSettings(capsuleSettings: { useAI?: boolean; activeProviderId?: string; systemPrompt?: string }): boolean {
  if (capsuleSettings.useAI !== undefined) {
    setSetting('capsule_use_ai', capsuleSettings.useAI)
  }
  if (capsuleSettings.activeProviderId !== undefined) {
    setSetting('capsule_active_provider_id', capsuleSettings.activeProviderId)
  }
  if (capsuleSettings.systemPrompt !== undefined) {
    setSetting('capsule_system_prompt', capsuleSettings.systemPrompt)
  }
  return true
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
    console.log('SQLite database closed')
  }
}
