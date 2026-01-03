import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs'

const MAX_BACKUPS = 7
const BACKUP_DIR = 'backups'

/**
 * 创建数据库备份
 */
export function createBackup(): void {
    const userDataPath = app.getPath('userData')
    const dbPath = join(userDataPath, 'zenhubboard.db')
    const backupDir = join(userDataPath, BACKUP_DIR)

    // 如果数据库不存在，跳过备份
    if (!existsSync(dbPath)) {
        console.log('Database not found, skipping backup')
        return
    }

    // 创建备份目录
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true })
    }

    // 生成备份文件名
    const date = new Date().toISOString().split('T')[0]
    const backupPath = join(backupDir, `zenhubboard-${date}.db`)

    // 如果今天的备份已存在，跳过
    if (existsSync(backupPath)) {
        console.log('Backup for today already exists')
        return
    }

    try {
        // 复制数据库文件
        copyFileSync(dbPath, backupPath)
        console.log(`Backup created: ${backupPath}`)

        // 清理旧备份
        cleanupOldBackups(backupDir)
    } catch (error) {
        console.error('Failed to create backup:', error)
    }
}

/**
 * 清理旧备份，保留最近 MAX_BACKUPS 个
 */
function cleanupOldBackups(backupDir: string): void {
    try {
        const files = readdirSync(backupDir)
            .filter(f => f.startsWith('zenhubboard-') && f.endsWith('.db'))
            .map(f => ({
                name: f,
                path: join(backupDir, f),
                time: statSync(join(backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time) // 按时间降序排列

        // 删除超出限制的旧备份
        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS)
            for (const file of toDelete) {
                unlinkSync(file.path)
                console.log(`Deleted old backup: ${file.name}`)
            }
        }
    } catch (error) {
        console.error('Failed to cleanup old backups:', error)
    }
}

/**
 * 在应用启动时初始化备份系统
 */
export function initBackupSystem(): void {
    console.log('Initializing backup system...')
    createBackup()
}
