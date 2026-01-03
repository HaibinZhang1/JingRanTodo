import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { getSettings, setSetting } from './database'
import { toggleDesktopMode, isDesktopAttachAvailable } from './desktopAttach'

// Register getMousePosition handler early (used by DesktopWidget)
ipcMain.handle('get-mouse-position', () => {
    const point = screen.getCursorScreenPoint()
    return { x: point.x, y: point.y }
})

// 桌面卡片窗口实例
let cardWindows: Map<string, BrowserWindow> = new Map()
// 卡片窗口模式 (floating | desktop)
let cardModes: Map<string, 'floating' | 'desktop'> = new Map()

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged

interface CardWindowOptions {
    id: string
    x?: number
    y?: number
    width?: number
    height?: number
    mode?: 'floating' | 'desktop'
    opacity?: number
    title?: string
}

/**
 * 通知所有窗口卡片列表发生变化
 */
function notifyCardListChanged() {
    const wins = BrowserWindow.getAllWindows()
    const cardIds = Array.from(cardWindows.keys())
    for (const win of wins) {
        if (!win.isDestroyed()) {
            win.webContents.send('card-list-changed', cardIds)
        }
    }
}

/**
 * 创建桌面卡片窗口
 */
export function createCardWindow(options: CardWindowOptions): BrowserWindow {
    const { id, opacity = 80, title = "任务卡片" } = options

    // 检查是否已存在同名窗口
    const existingWindow = cardWindows.get(id)
    if (existingWindow) {
        if (existingWindow.isMinimized()) existingWindow.restore()
        existingWindow.show()
        existingWindow.focus()
        return existingWindow
    }

    // 关闭其他存在的卡片窗口，确保同时只有一个浮窗 (根据需求，可能想要多个？但之前逻辑是关闭其他的)
    // 现在的需求是 "每个任务卡片开启浮窗"，implies multiple?
    // User request: "每个任务卡片开启浮窗后禁用开启浮窗按钮" implies one-to-one mapping.
    // Previous logic (lines 37-46 in original) closed other windows.
    // The user didn't explicitly say "allow multiple". But "Disable button if window is open" implies checking specific ID.
    // If I allow multiple, the logic changes.
    // Given "Close others" was existing logic, I should clarify or stick to it.
    // BUT, "Disable button IF window is open" usually implies that SPECIFIC window.
    // If opening Card B closes Card A, then Card A's button should re-enable.
    // I will KEEP the "Close others" logic for now unless requested otherwise, as managing multiple valid floating windows might be complex/cluttered.
    // Wait, if I close others, then `activeCardIds` will only ever have 1 item.
    // If the user wants "Disable button UNTIL closed", they might expect multiple?
    // Let's look at the request: "每个任务卡片开启浮窗后禁用开启浮窗按钮，直到浮窗被关闭"
    // "Record each floating window's position". This strongly implies multiple windows could exist, or at least they have unique positions.
    // I will RELAX the "close others" restriction to allow multiple cards if the user opens them?
    // Actually, to remain safe and consistent with previous behavior which seemed to enforce a singleton or limited set, I'll stick to singleton for now?
    // No, if I enforce singleton, "Disable button" for THAT card is trivial (it's the only one).
    // Let's assume the user wants to enable multiple floating windows or just switch between them.
    // If I keep "Close others", I should remove that block to allow multiple.
    // I will COMMENT OUT the "Close others" block to allow multiple windows, as that seems more aligned with "Each task card..." having its own state.

    /*
    // COMMENTED OUT: Allow multiple floating windows
    Array.from(cardWindows.keys()).forEach(existingId => {
        if (existingId !== id) {
             try {
                const win = cardWindows.get(existingId)
                win?.close()
            } catch (e) {
                console.error(`Failed to close window ${existingId}:`, e)
            }
        }
    })
    */

    // 获取屏幕尺寸
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const defaultWidth = 320
    const defaultHeight = 400
    const defaultX = screenWidth - defaultWidth - 20
    const defaultY = screenHeight - defaultHeight - 60

    // 读取保存的位置
    const settings = getSettings()
    let savedPos = settings.cardPositions?.[id]

    // One-time reset for card positions - 2024/12/14 v3 resets both today and week
    const resetFlags = settings.resetFlags || {}
    if ((id === 'card-week' || id === 'card-today') && !resetFlags.cardPositionReset_20251214_v3) {
        savedPos = undefined // Force default position
        setSetting('resetFlags', { ...resetFlags, cardPositionReset_20251214_v3: true })
        console.log(`[Main] Resetting position for ${id} (v3)`)
    }

    // 优先使用传入参数 -> 保存的位置 -> 默认位置
    const finalX = options.x ?? savedPos?.x ?? defaultX
    const finalY = options.y ?? savedPos?.y ?? defaultY
    const finalWidth = options.width ?? savedPos?.width ?? defaultWidth
    const finalHeight = options.height ?? savedPos?.height ?? defaultHeight
    const savedMode = savedPos?.mode || 'floating'

    console.log(`[Main] Creating Card Window: id=${id}, x=${finalX}, y=${finalY}, w=${finalWidth}, h=${finalHeight}, mode=${savedMode}`)

    const cardWindow = new BrowserWindow({
        width: finalWidth,
        height: finalHeight,
        x: finalX,
        y: finalY,
        frame: false, // 无边框
        transparent: true, // 透明背景
        resizable: true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true, // 不显示在任务栏，防止被Win+D最小化
        alwaysOnTop: true, // 默认置顶
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
        show: true
    })

    // Log window events
    cardWindow.once('ready-to-show', () => {
        console.log(`[Main] Card window ${id} ready to show`)
        // Restore desktop mode if saved
        if (savedMode === 'desktop') {
            // Delay slightly to ensure window is fully initialized
            setTimeout(() => {
                if (!cardWindow.isDestroyed()) {
                    if (toggleDesktopMode(id, cardWindow, true)) {
                        cardModes.set(id, 'desktop')
                        console.log(`[CardWindow] Restored ${id} to desktop mode`)
                    }
                }
            }, 500)
        }
    })

    cardWindow.webContents.on('did-finish-load', () => {
        console.log(`[Main] Card window ${id} loaded successfully`)
        // 开发模式下打开 DevTools
        if (isDev) {
            cardWindow.webContents.openDevTools({ mode: 'detach' })
        }
    })

    cardWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`[Main] Card window ${id} failed to load:`, errorCode, errorDescription)
    })

    // 加载页面
    const url = isDev
        ? `http://localhost:5173/#/card?id=${id}&opacity=${opacity}&title=${encodeURIComponent(title)}`
        : `file://${join(__dirname, '../../dist/index.html')}#/card?id=${id}&opacity=${opacity}&title=${encodeURIComponent(title)}`

    console.log(`[Main] Loading card window URL: ${url}`)
    cardWindow.loadURL(url)

    // 保存窗口位置和尺寸
    const handleSaveBounds = () => {
        saveCardPosition(id, cardWindow)
    }
    cardWindow.on('moved', handleSaveBounds)
    cardWindow.on('resized', handleSaveBounds)

    // Note: Removed electron-disable-minimize as it breaks z-ordering
    // Win+D prevention is handled by using alwaysOnTop levels instead

    cardWindow.on('closed', () => {
        // Detach from desktop if in desktop mode before closing
        const mode = cardModes.get(id)
        if (mode === 'desktop') {
            toggleDesktopMode(id, cardWindow, false)
        }
        cardWindows.delete(id)
        cardModes.delete(id)
        notifyCardListChanged()
    })

    cardWindows.set(id, cardWindow)
    cardModes.set(id, 'floating') // Default to floating mode

    // Save title immediately for restoration
    const finalSettings = getSettings()
    const finalPositions = finalSettings.cardPositions || {}
    finalPositions[id] = { ...(finalPositions[id] || {}), title }
    setSetting('cardPositions', finalPositions)

    notifyCardListChanged() // 通知更新
    return cardWindow
}

/**
 * 保存卡片窗口位置
 */
function saveCardPosition(id: string, window: BrowserWindow) {
    if (window.isDestroyed()) return
    const bounds = window.getBounds()
    const settings = getSettings()
    const cardPositions = settings.cardPositions || {}
    // 合并现有设置
    cardPositions[id] = {
        ...(cardPositions[id] || {}),
        ...bounds
    }
    setSetting('cardPositions', cardPositions)
}

/**
 * 获取卡片窗口
 */
export function getCardWindow(id: string): BrowserWindow | undefined {
    return cardWindows.get(id)
}

/**
 * 关闭卡片窗口
 */
export function closeCardWindow(id: string) {
    const window = cardWindows.get(id)
    if (window) {
        window.close()
        // 'closed' event handler will do the cleanup and notification
    }
}

/**
 * 关闭所有卡片窗口
 */
export function closeAllCardWindows() {
    cardWindows.forEach((window) => {
        window.close()
    })
    cardWindows.clear()
    notifyCardListChanged()
}

/**
 * 设置卡片窗口透明度
 */
export function setCardOpacity(id: string, opacity: number) {
    const window = cardWindows.get(id)
    // 保存透明度设置
    const settings = getSettings()
    const cardPositions = settings.cardPositions || {}
    if (cardPositions[id] || true) {
        cardPositions[id] = { ...(cardPositions[id] || {}), opacity }
        setSetting('cardPositions', cardPositions)
    }
}

/**
 * 恢复保存的卡片窗口
 */
export async function restoreSavedCards() {
    const settings = getSettings()
    // 恢复时可能需要考虑是否自动打开上次打开的？
    // 目前暂不自动恢复所有，除非 explicitly requested via 'activeCards' setting which we track
    const savedCards = settings.activeCards || []
    const cardPositions = settings.cardPositions || {}

    for (const cardId of savedCards) {
        // 恢复时也使用 createCardWindow，它会读取 saved position
        const position = cardPositions[cardId] || {}

        // Determine title: saved title, or fallback for known IDs
        let restoredTitle = position.title
        if (!restoredTitle) {
            if (cardId === 'card-today') restoredTitle = '今日待办'
            else if (cardId === 'card-week') restoredTitle = '本周待办'
            else if (cardId === 'card-nextWeek') restoredTitle = '下周计划'
            // Custom panels: card-panel-ID - title should have been saved, or show generic.
        }

        createCardWindow({
            id: cardId,
            opacity: position.opacity || 80,
            title: restoredTitle // Restore title with fallback
        })
    }
}

/**
 * 设置卡片窗口相关的 IPC 处理器
 */
export function setupCardWindowIPC() {
    // 创建卡片窗口
    ipcMain.handle('card-create', async (_, options: CardWindowOptions) => {
        console.log('[Main] Received card-create request:', options)
        const window = createCardWindow(options)
        // 保存活跃卡片列表
        const settings = getSettings()
        const activeCards = settings.activeCards || []
        if (!activeCards.includes(options.id)) {
            activeCards.push(options.id)
            setSetting('activeCards', activeCards)
        }
        return window.id
    })

    // 关闭卡片窗口
    ipcMain.on('card-close', (_, id: string) => {
        closeCardWindow(id)
        // 从活跃卡片列表移除
        const settings = getSettings()
        const activeCards = (settings.activeCards || []).filter((cid: string) => cid !== id)
        setSetting('activeCards', activeCards)
    })

    // 设置卡片透明度
    ipcMain.on('card-set-opacity', (_, id: string, opacity: number) => {
        setCardOpacity(id, opacity)
    })

    // 设置卡片置顶状态 - using levels to prevent Win+D while allowing z-order change
    ipcMain.on('card-set-always-on-top', (_, id: string, alwaysOnTop: boolean) => {
        const window = cardWindows.get(id)
        if (window) {
            if (alwaysOnTop) {
                // Pinned: use 'screen-saver' level for truly on top
                window.setAlwaysOnTop(true)
            } else {
                // Unpinned: use 'floating' level - lower than other always-on-top windows
                // but still resists Win+D minimize. Other focused windows can cover it.
                window.setAlwaysOnTop(true, 'normal')
            }
        }
    })

    // 获取所有卡片窗口 ID
    ipcMain.handle('card-get-all', async () => {
        return Array.from(cardWindows.keys())
    })

    // 移动卡片窗口
    ipcMain.on('card-move', (_, id: string, deltaX: number, deltaY: number) => {
        const window = cardWindows.get(id)
        if (window) {
            const [x, y] = window.getPosition()
            window.setPosition(x + deltaX, y + deltaY)
            saveCardPosition(id, window)
        }
    })

    // 调整卡片窗口大小
    ipcMain.on('card-resize', (_, id: string, width: number, height: number) => {
        const window = cardWindows.get(id)
        if (window) {
            window.setSize(width, height)
            saveCardPosition(id, window)
        }
    })

    // 设置卡片窗口是否可缩放（贴边收起时禁用）
    ipcMain.on('card-set-resizable', (_, id: string, resizable: boolean) => {
        const window = cardWindows.get(id)
        if (window && !window.isDestroyed()) {
            window.setResizable(resizable)
            // 确保窗口始终可移动，即使禁用了缩放
            window.setMovable(true)
            console.log(`[CardWindow] Set ${id} resizable: ${resizable}, movable: true`)
        }
    })

    // 设置卡片窗口收起/展开状态（调整窗口高度）
    ipcMain.on('card-set-collapsed', (_, id: string, collapsed: boolean, originalHeight: number) => {
        const window = cardWindows.get(id)
        if (window && !window.isDestroyed()) {
            const [width] = window.getSize()
            if (collapsed) {
                // 收起：高度变为5px，启用鼠标穿透让桌面图标可点击
                // 不使用 forward: true，避免干扰其他窗口拖拽
                window.setSize(width, 5)
                window.setIgnoreMouseEvents(true)
                console.log(`[CardWindow] Collapsed ${id} to 5px height with click-through`)
            } else {
                // 展开：恢复原始高度，禁用鼠标穿透
                window.setSize(width, originalHeight)
                window.setIgnoreMouseEvents(false)
                console.log(`[CardWindow] Expanded ${id} to ${originalHeight}px height`)
            }
        }
    })


    // 切换桌面模式 (floating <-> desktop) - 使用窗口重建方案
    ipcMain.on('card-toggle-mode', (_, id: string, mode: 'floating' | 'desktop') => {
        const oldWindow = cardWindows.get(id)
        if (!oldWindow || oldWindow.isDestroyed()) return

        const currentMode = cardModes.get(id) || 'floating'
        if (currentMode === mode) return // No change

        // *** 获取坐标和状态 ***
        const settings = getSettings()
        const cardPositions = settings.cardPositions || {}
        const savedInfo = cardPositions[id] || {}
        const title = savedInfo.title || '任务卡片'
        const opacity = savedInfo.opacity || 80

        // *** 关键修复：desktop 模式下 getBounds() 返回错误坐标 ***
        // 所以从 desktop 切换时，使用保存的正确位置
        let bounds: { x: number; y: number; width: number; height: number }
        if (currentMode === 'desktop') {
            // 使用保存的设置中的位置（这是正确的）
            bounds = {
                x: savedInfo.x ?? oldWindow.getBounds().x,
                y: savedInfo.y ?? oldWindow.getBounds().y,
                width: savedInfo.width ?? oldWindow.getBounds().width,
                height: savedInfo.height ?? oldWindow.getBounds().height
            }
            console.log(`[CardWindow] Using saved bounds for desktop window: (${bounds.x}, ${bounds.y})`)
        } else {
            // floating 模式下 getBounds() 是正确的
            bounds = oldWindow.getBounds()
        }

        console.log(`[CardWindow] Toggle ${id}: ${currentMode} -> ${mode}, bounds=(${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height})`)

        // *** 只有 floating 模式下才更新保存的位置 ***
        // desktop 模式的位置是错误的，不要保存
        if (currentMode === 'floating') {
            cardPositions[id] = {
                ...savedInfo,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                mode: mode
            }
        } else {
            // 仅更新模式，不更新位置
            cardPositions[id] = {
                ...savedInfo,
                mode: mode
            }
        }
        setSetting('cardPositions', cardPositions)

        // *** 从追踪中移除旧窗口(避免触发closed事件的清理逻辑) ***
        cardWindows.delete(id)
        cardModes.delete(id)

        // *** 关闭旧窗口 ***
        oldWindow.destroy() // 使用 destroy 而不是 close 避免触发 closed 事件

        // *** 创建新窗口 - 直接在正确位置创建 ***
        console.log(`[CardWindow] Recreating window ${id} at (${bounds.x}, ${bounds.y}) in ${mode} mode`)

        const newWindow = new BrowserWindow({
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            frame: false,
            transparent: true,
            resizable: true,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: join(__dirname, '../preload/index.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false
            },
            show: false // 先不显示，等加载完成后再处理
        })

        // 加载页面
        const url = isDev
            ? `http://localhost:5173/#/card?id=${id}&opacity=${opacity}&title=${encodeURIComponent(title)}`
            : `file://${join(__dirname, '../../dist/index.html')}#/card?id=${id}&opacity=${opacity}&title=${encodeURIComponent(title)}`
        newWindow.loadURL(url)

        // 添加到追踪
        cardWindows.set(id, newWindow)
        cardModes.set(id, mode)

        // 窗口加载完成后处理桌面模式
        newWindow.once('ready-to-show', () => {
            // 先显示窗口，确保 Electron 在正确位置创建它
            newWindow.show()
            console.log(`[CardWindow] Window ${id} shown at Electron coords (${bounds.x}, ${bounds.y})`)

            if (mode === 'desktop') {
                // 等窗口显示后再附加到桌面
                // 这样 Electron 有机会先在正确位置创建窗口
                setTimeout(() => {
                    if (!newWindow.isDestroyed()) {
                        if (toggleDesktopMode(id, newWindow, true)) {
                            console.log(`[CardWindow] Window ${id} attached to desktop mode`)
                        }
                    }
                }, 100)
            } else {
                console.log(`[CardWindow] Window ${id} recreated in floating mode`)
            }
        })

        // 保存窗口位置和尺寸
        const handleSaveBounds = () => {
            if (!newWindow.isDestroyed()) {
                const newBounds = newWindow.getBounds()
                const latestSettings = getSettings()
                const latestPositions = latestSettings.cardPositions || {}
                latestPositions[id] = { ...(latestPositions[id] || {}), ...newBounds }
                setSetting('cardPositions', latestPositions)
            }
        }
        newWindow.on('moved', handleSaveBounds)
        newWindow.on('resized', handleSaveBounds)

        newWindow.on('closed', () => {
            const windowMode = cardModes.get(id)
            if (windowMode === 'desktop') {
                toggleDesktopMode(id, newWindow, false)
            }
            cardWindows.delete(id)
            cardModes.delete(id)
            // 从活跃卡片列表移除
            const latestSettings = getSettings()
            const activeCards = (latestSettings.activeCards || []).filter((cid: string) => cid !== id)
            setSetting('activeCards', activeCards)
            notifyCardListChanged()
        })

        notifyCardListChanged()
    })

    // 获取桌面附加功能是否可用
    ipcMain.handle('card-desktop-available', async () => {
        return isDesktopAttachAvailable()
    })

    // 获取卡片当前模式
    ipcMain.handle('card-get-mode', async (_, id: string) => {
        return cardModes.get(id) || 'floating'
    })

    // 重置所有卡片窗口位置
    ipcMain.handle('card-reset-positions', async () => {
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
        const defaultWidth = 320
        const defaultHeight = 400
        const defaultX = screenWidth - defaultWidth - 20
        const defaultY = screenHeight - defaultHeight - 60

        // 重置保存的位置
        setSetting('cardPositions', {})

        // 移动所有已打开的卡片窗口到默认位置
        let offset = 0
        cardWindows.forEach((window, id) => {
            if (!window.isDestroyed()) {
                const x = defaultX - offset * 30
                const y = defaultY - offset * 30
                window.setPosition(x, y)
                window.setSize(defaultWidth, defaultHeight)
                offset++
            }
        })

        console.log('[CardWindow] Reset all card positions to defaults')
        return true
    })
}
