import { app, BrowserWindow } from 'electron'
import { join, isAbsolute } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync, copyFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { getSettings } from './database'

// Note interface matching the schema
export interface Note {
    id: string
    title: string
    content: string
    updatedAt: number
    isFloating: boolean
    isPinned: boolean
    position: { x: number; y: number }
    width: number
    height: number
    zIndex: number
    mode: 'edit' | 'split' | 'preview'
    showOnDashboard: boolean  // 是否在主页显示为卡片
    dashboardOrder: number    // 在主页的排序位置
}

type NoteMeta = Omit<Note, 'content'>

// Helper to notify all windows
function notifyNoteDataChanged() {
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('note-data-changed')
        }
    })
}

// Async function to resolve notes directory from settings
async function resolveNotesDir(): Promise<string> {
    try {
        const settings = await getSettings()
        let notesPath = settings['notes_path'] as string

        if (!notesPath) {
            notesPath = join(app.getAppPath(), 'public', 'notes')
        }

        if (!existsSync(notesPath)) {
            mkdirSync(notesPath, { recursive: true })
        }
        return notesPath
    } catch (e) {
        console.error('Failed to resolve notes dir:', e)
        const fallback = join(app.getPath('userData'), 'notes')
        if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true })
        return fallback
    }
}

function getMetaPath(): string {
    const userDataPath = app.getPath('userData')
    return join(userDataPath, 'notes-meta.json')
}

// 统一读取 Metadata
function readMeta(): Record<string, NoteMeta> {
    const metaPath = getMetaPath()
    if (!existsSync(metaPath)) {
        return {}
    }
    try {
        const data = readFileSync(metaPath, 'utf-8')
        return JSON.parse(data)
    } catch (e) {
        console.error('Failed to read notes meta:', e)
        return {}
    }
}

function writeMeta(meta: Record<string, NoteMeta>) {
    try {
        writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8')
    } catch (e) {
        console.error('Failed to write notes meta:', e)
    }
}

function copyDefaultNotes(targetDir: string) {
    // Determine path to default notes based on environment
    let defaultNotesDir = '';
    if (app.isPackaged) {
        defaultNotesDir = join(process.resourcesPath, 'public', 'default_notes');
    } else {
        defaultNotesDir = join(app.getAppPath(), 'public', 'default_notes');
    }

    if (!existsSync(defaultNotesDir)) {
        // Fallback or skip
        return;
    }

    // Only initialize if meta file does NOT exist (first run or reset)
    const metaPath = getMetaPath();
    if (existsSync(metaPath)) {
        return;
    }

    console.log('[Notes] Initializing default notes from:', defaultNotesDir);

    try {
        // Copy meta file
        const defaultMetaPath = join(defaultNotesDir, 'notes-meta.json');
        if (existsSync(defaultMetaPath)) {
            copyFileSync(defaultMetaPath, metaPath);
        }

        // Copy markdown files
        const files = readdirSync(defaultNotesDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                copyFileSync(join(defaultNotesDir, file), join(targetDir, file));
            }
        }
    } catch (e) {
        console.error('[Notes] Failed to copy default notes:', e);
    }
}

export async function getAllNotes(): Promise<Note[]> {
    const notesDir = await resolveNotesDir()

    // Ensure default notes are present if this is a fresh install
    copyDefaultNotes(notesDir)

    const meta = readMeta()
    const notes: Note[] = []

    // 迁移：将现有的 .txt 文件重命名为 .md
    try {
        const allFiles = readdirSync(notesDir)
        for (const file of allFiles) {
            if (file.endsWith('.txt')) {
                const oldPath = join(notesDir, file)
                const newPath = join(notesDir, file.replace('.txt', '.md'))
                if (!existsSync(newPath)) {
                    const fs = require('fs')
                    fs.renameSync(oldPath, newPath)
                }
            }
        }
    } catch (e) {
        console.error('Failed to migrate .txt files:', e)
    }

    // 读取目录中的 .md 文件
    let files: string[] = []
    try {
        files = readdirSync(notesDir).filter(f => f.endsWith('.md'))
    } catch (e) {
        console.error('Failed to read notes directory:', e)
        return []
    }

    for (const file of files) {
        const filename = file
        const title = filename.replace('.md', '')
        const filePath = join(notesDir, file)

        let content = ''
        try {
            content = readFileSync(filePath, 'utf-8')
        } catch (e) {
            console.error(`Failed to read note file ${file}:`, e)
            continue
        }

        // 查找对应的 meta
        let noteMeta: NoteMeta | undefined

        // 反向查找 Meta
        const metaId = Object.keys(meta).find(id => meta[id].title === title)

        if (metaId) {
            noteMeta = meta[metaId]
        } else {
            // New file found on disk
            const stats = statSync(filePath)
            // Create default meta
            const newId = randomUUID()
            noteMeta = {
                id: newId,
                title: title,
                updatedAt: stats.mtimeMs,
                isFloating: false,
                isPinned: false,
                position: { x: 100, y: 100 },
                width: 320,
                height: 400,
                zIndex: 1,
                mode: 'edit',
                showOnDashboard: false,
                dashboardOrder: 0
            }
            // Update meta immediately
            meta[newId] = noteMeta as NoteMeta
            writeMeta(meta)
        }

        notes.push({
            ...noteMeta,
            content,
            showOnDashboard: noteMeta.showOnDashboard ?? false,
            dashboardOrder: noteMeta.dashboardOrder ?? 0
        } as Note)
    }

    // 检查 Meta 中有但文件不存在的条目 (被外部删除)
    const existingTitles = files.map(f => f.replace('.md', ''))
    let metaChanged = false
    Object.keys(meta).forEach(id => {
        if (!existingTitles.includes(meta[id].title)) {
            delete meta[id]
            metaChanged = true
        }
    })
    if (metaChanged) writeMeta(meta)

    // 按 updatedAt 倒序
    return notes.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createNote(note: Partial<Note>): Promise<Note> {
    const notesDir = await resolveNotesDir()
    const meta = readMeta()

    const id = note.id || randomUUID()
    // 确保 title 唯一
    let title = note.title || '未命名笔记'
    let suffix = 0
    while (existsSync(join(notesDir, `${title}${suffix ? `_${suffix}` : ''}.md`))) {
        suffix++
    }
    if (suffix > 0) title = `${title}_${suffix}`

    // Spread note first, then override with computed values
    const newNote: Note = Object.assign(
        {
            content: note.content || '',
            updatedAt: Date.now(),
            isFloating: false,
            isPinned: false,
            position: { x: 100, y: 100 },
            width: 320,
            height: 400,
            zIndex: 1,
            mode: 'edit' as const,
            showOnDashboard: false,
            dashboardOrder: 0,
        },
        note,
        {
            id,    // Use generated id (or from note if provided)
            title, // Use unique title (ensures no duplicates)
        }
    )

    // Write file
    const filePath = join(notesDir, `${title}.md`)
    writeFileSync(filePath, newNote.content, 'utf-8')

    // Write meta
    const { content, ...noteMeta } = newNote
    meta[id] = noteMeta
    writeMeta(meta)

    notifyNoteDataChanged()
    return newNote
}

export async function updateNote(note: Partial<Note> & { id: string }): Promise<Note> {
    const notesDir = await resolveNotesDir()
    const meta = readMeta()

    const currentMeta = meta[note.id]
    if (!currentMeta) {
        throw new Error('Note not found')
    }

    const mergedNote: Note = {
        ...currentMeta,
        content: '', // Placeholder, will read/write below
        ...note
    }

    // Handle Rename
    if (note.title && note.title !== currentMeta.title) {
        const oldPath = join(notesDir, `${currentMeta.title}.md`)
        const newPath = join(notesDir, `${note.title}.md`)

        if (existsSync(newPath)) {
            if (note.title.toLowerCase() !== currentMeta.title.toLowerCase()) {
                throw new Error(`File ${note.title}.md already exists`)
            }
        }

        if (existsSync(oldPath)) {
            const fs = require('fs')
            fs.renameSync(oldPath, newPath)
        }
    }

    // Handle Content Update
    const filePath = join(notesDir, `${mergedNote.title}.md`)
    if (note.content !== undefined) {
        writeFileSync(filePath, note.content, 'utf-8')
    } else {
        // Read current content if not updating
        if (existsSync(filePath)) {
            mergedNote.content = readFileSync(filePath, 'utf-8')
        }
    }

    // Update Meta
    const { content, ...newMeta } = mergedNote
    newMeta.updatedAt = Date.now()
    meta[note.id] = newMeta
    writeMeta(meta)

    notifyNoteDataChanged()
    return mergedNote
}

export async function deleteNote(id: string): Promise<void> {
    const notesDir = await resolveNotesDir()
    const meta = readMeta()

    const noteMeta = meta[id]
    if (noteMeta) {
        const filePath = join(notesDir, `${noteMeta.title}.md`)

        // 删除笔记关联的图片
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, 'utf-8')
                // 匹配 Markdown 图片语法: ![alt](/images/notes/xxx.png)
                const imageRegex = /!\[.*?\]\((\/images\/notes\/[^)]+)\)/g
                let match
                while ((match = imageRegex.exec(content)) !== null) {
                    const relativePath = match[1] // e.g., /images/notes/1234567890-photo.png
                    const imagePath = app.isPackaged
                        ? join(process.resourcesPath, 'public', relativePath)
                        : join(__dirname, '..', '..', 'public', relativePath)

                    if (existsSync(imagePath)) {
                        try {
                            unlinkSync(imagePath)
                        } catch (imgErr) {
                            console.error('[Notes] Failed to delete image:', relativePath, imgErr)
                        }
                    }
                }
            } catch (e) {
                console.error('[Notes] Failed to read note for image cleanup:', e)
            }

            // 删除笔记文件
            unlinkSync(filePath)
        }

        delete meta[id]
        writeMeta(meta)
        notifyNoteDataChanged()
    }
}

/**
 * 清理孤立的笔记图片
 * 扫描所有笔记内容，找出被引用的图片，删除未被引用的图片
 */
export async function cleanupOrphanedNoteImages(): Promise<{ deleted: number; files: string[] }> {
    const result = { deleted: 0, files: [] as string[] }

    try {
        // 获取图片目录
        const imagesDir = app.isPackaged
            ? join(process.resourcesPath, 'public', 'images', 'notes')
            : join(__dirname, '..', '..', 'public', 'images', 'notes')

        if (!existsSync(imagesDir)) {
            return result
        }

        // 获取目录中所有图片文件
        const allImages = readdirSync(imagesDir)
            .filter(f => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(f))

        if (allImages.length === 0) {
            return result
        }

        // 获取所有笔记并提取引用的图片
        const notes = await getAllNotes()
        const referencedImages = new Set<string>()

        const imageRegex = /!\[.*?\]\(\/images\/notes\/([^)]+)\)/g
        for (const note of notes) {
            let match
            while ((match = imageRegex.exec(note.content)) !== null) {
                referencedImages.add(match[1]) // filename only
            }
        }

        // 删除未被引用的图片
        for (const imageFile of allImages) {
            if (!referencedImages.has(imageFile)) {
                const imagePath = join(imagesDir, imageFile)
                try {
                    unlinkSync(imagePath)
                    result.deleted++
                    result.files.push(imageFile)
                } catch (e) {
                    console.error('[Notes] Failed to delete orphaned image:', imageFile, e)
                }
            }
        }

        // Orphan cleanup complete
    } catch (e) {
        console.error('[Notes] Failed to cleanup orphaned images:', e)
    }

    return result
}
