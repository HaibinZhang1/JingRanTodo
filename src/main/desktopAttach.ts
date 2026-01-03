/**
 * Desktop Attach Module - Multi-Window Management (using koffi)
 * Uses Win32 APIs via koffi to attach Electron windows above the desktop icon layer.
 * 
 * Strategy: Attach to the PARENT of SHELLDLL_DefView (Progman or WorkerW container),
 * making our window a SIBLING of the icon layer, then use Z-order to stay above icons.
 * 
 * 多窗口管理特性:
 * 1. 单一全局定时器管理所有窗口，节省资源
 * 2. 自动维护 Z 序：用户点击窗口自动置顶
 * 3. 批量防闪烁恢复：检测到被图标遮挡时，按正确顺序批量恢复
 */

import { BrowserWindow } from 'electron'

// koffi is dynamically loaded
let koffi: any = null
let user32: any = null
let isAvailable = false

// Win32 Constants
const SWP_NOMOVE = 0x0002
const SWP_NOSIZE = 0x0001
const SWP_NOACTIVATE = 0x0010
const SWP_SHOWWINDOW = 0x0040
const SWP_NOZORDER = 0x0004
const GWL_STYLE = -16
const WS_CHILD = 0x40000000
const WS_VISIBLE = 0x10000000
const WS_POPUP = 0x80000000
const HWND_TOP = 0  // For SetWindowPos - brings window to top of Z-order
const GW_HWNDPREV = 3  // For GetWindow - gets the window above in Z-order

// Store container handles for each window
const containerHandles: Map<string, number> = new Map()

// Function types for koffi
let FindWindowW: any = null
let FindWindowExW: any = null
let SetParent: any = null
let GetParent: any = null
let SetWindowLongPtrW: any = null
let GetWindowLongPtrW: any = null
let SetWindowPos: any = null
let GetWindow: any = null
let EnumWindows: any = null
let EnumWindowsProc: any = null
let GetWindowRect: any = null
let ScreenToClient: any = null

/**
 * Initialize the koffi module (lazy load)
 */
function initKoffi(): boolean {
    if (isAvailable) return true
    if (koffi !== null && !isAvailable) return false // Already tried and failed

    try {
        koffi = require('koffi')

        // Load user32.dll
        user32 = koffi.load('user32.dll')

        // Define callback type for EnumWindows
        EnumWindowsProc = koffi.proto('bool EnumWindowsProc(intptr hwnd, intptr lParam)')

        // Define RECT structure for GetWindowRect
        const RECT = koffi.struct('RECT', {
            left: 'int',
            top: 'int',
            right: 'int',
            bottom: 'int'
        })

        // Define POINT structure for ScreenToClient
        const POINT = koffi.struct('POINT', {
            x: 'int',
            y: 'int'
        })

        // Define user32 functions
        FindWindowW = user32.func('intptr FindWindowW(str16 lpClassName, str16 lpWindowName)')
        FindWindowExW = user32.func('intptr FindWindowExW(intptr hWndParent, intptr hWndChildAfter, str16 lpszClass, str16 lpszWindow)')
        SetParent = user32.func('intptr SetParent(intptr hWndChild, intptr hWndNewParent)')
        GetParent = user32.func('intptr GetParent(intptr hWnd)')
        SetWindowLongPtrW = user32.func('longlong SetWindowLongPtrW(intptr hWnd, int nIndex, longlong dwNewLong)')
        GetWindowLongPtrW = user32.func('longlong GetWindowLongPtrW(intptr hWnd, int nIndex)')
        SetWindowPos = user32.func('bool SetWindowPos(intptr hWnd, intptr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)')
        GetWindow = user32.func('intptr GetWindow(intptr hWnd, uint uCmd)')
        EnumWindows = user32.func('bool EnumWindows(EnumWindowsProc* lpEnumFunc, intptr lParam)')

        // Functions for position preservation
        GetWindowRect = user32.func('bool GetWindowRect(intptr hWnd, _Out_ RECT* lpRect)')
        ScreenToClient = user32.func('bool ScreenToClient(intptr hWnd, _Inout_ POINT* lpPoint)')

        isAvailable = true
        return true
    } catch (err) {
        console.warn('[DesktopAttach] koffi not available:', err)
        koffi = false // Mark as tried
        return false
    }
}

/**
 * Find the SHELLDLL_DefView window and its parent container.
 * Returns { shellDefView, container } where container is the parent of SHELLDLL_DefView.
 */
function findShellDefViewAndContainer(): { shellDefView: number | null; container: number | null } {
    if (!initKoffi()) return { shellDefView: null, container: null }

    let shellDefView: number | null = null
    let container: number | null = null

    try {
        // First, try to find in Progman
        const progman = FindWindowW('Progman', null)

        if (progman) {
            const found = FindWindowExW(progman, 0, 'SHELLDLL_DefView', null)
            if (found) {
                shellDefView = found
                container = progman
                return { shellDefView, container }
            }
        }

        // If not found in Progman, enumerate WorkerW windows
        const callback = koffi.register((hwnd: number, _lParam: number) => {
            try {
                const child = FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null)
                if (child) {
                    shellDefView = child
                    container = hwnd
                    return false // Stop enumeration
                }
            } catch (e) {
                // Ignore errors during enumeration
            }
            return true // Continue
        }, koffi.pointer(EnumWindowsProc))

        EnumWindows(callback, 0)
        koffi.unregister(callback)

    } catch (err) {
        console.error('[DesktopAttach] Error finding SHELLDLL_DefView:', err)
    }

    return { shellDefView, container }
}

// ============= 多窗口桌面模式管理器 =============

interface WindowEntry {
    windowId: string
    hwnd: number
    win?: BrowserWindow
}

/**
 * 全局多窗口桌面模式管理器
 * 解决多窗口各自定时器争抢层级问题
 */
const DesktopModeManager = {
    intervalId: null as NodeJS.Timeout | null,
    // 窗口队列：存储 { windowId, hwnd, win }
    // 顺序意义：数组末尾的元素 = Z序最顶层 (Last Active)
    windows: [] as WindowEntry[],

    /**
     * 注册新窗口到桌面模式管理
     */
    add(windowId: string, hwnd: number, win?: BrowserWindow): void {
        const existing = this.windows.find(w => w.windowId === windowId)
        if (existing) {
            return
        }

        const entry: WindowEntry = { windowId, hwnd, win }

        // 初始置顶
        this._setTop(hwnd)

        // 存入队列 (新窗口在最顶层)
        this.windows.push(entry)

        // 如果提供了 BrowserWindow，监听焦点事件
        if (win && !win.isDestroyed()) {
            const focusHandler = () => {
                this._bringToFrontInQueue(entry)
                this._setTop(hwnd)
            }
            win.on('focus', focusHandler)

            const closedHandler = () => {
                this.remove(windowId)
            }
            win.once('closed', closedHandler)
        }

        // 确保全局保活定时器已启动
        this._startTimer()
    },

    /**
     * 移除窗口管理
     */
    remove(windowId: string): void {
        const index = this.windows.findIndex(w => w.windowId === windowId)
        if (index > -1) {
            this.windows.splice(index, 1)
        }
        // 如果没有窗口了，停止定时器
        if (this.windows.length === 0) {
            this._stopTimer()
        }
    },

    /**
     * 当窗口获得焦点时调用，将其提升到最顶层
     */
    bringToFront(windowId: string): void {
        const entry = this.windows.find(w => w.windowId === windowId)
        if (entry) {
            this._bringToFrontInQueue(entry)
            this._setTop(entry.hwnd)
        }
    },

    // --- 内部私有方法 ---

    /**
     * 设置窗口置顶 (不激活)
     */
    _setTop(hwnd: number): void {
        if (!initKoffi()) return
        try {
            SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)
        } catch (err) {
            // Silently fail
        }
    },

    /**
     * 调整队列顺序：将窗口移到末尾（最顶层）
     */
    _bringToFrontInQueue(entry: WindowEntry): void {
        const index = this.windows.indexOf(entry)
        if (index === this.windows.length - 1) return // 已在最顶层

        if (index > -1) {
            this.windows.splice(index, 1)
            this.windows.push(entry)
        }
    },

    _startTimer(): void {
        if (this.intervalId) return

        this.intervalId = setInterval(() => {
            this._checkAndRecover()
        }, 2000)
    },

    _stopTimer(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    },

    /**
     * 核心：批量检测与恢复逻辑
     */
    _checkAndRecover(): void {
        if (this.windows.length === 0) return
        if (!initKoffi()) return

        const { shellDefView } = findShellDefViewAndContainer()
        if (!shellDefView) return

        // 检查队列中最顶层的窗口是否被图标层遮挡
        const topEntry = this.windows[this.windows.length - 1]
        if (!topEntry) return

        let currentHwnd = topEntry.hwnd
        let isBlockedByIcons = false

        try {
            // 向上探测 20 层
            for (let i = 0; i < 20; i++) {
                currentHwnd = GetWindow(currentHwnd, GW_HWNDPREV)
                if (currentHwnd === 0) break

                if (currentHwnd === shellDefView) {
                    isBlockedByIcons = true
                    break
                }
            }

            // 如果被遮挡，按队列顺序重新刷一遍层级
            if (isBlockedByIcons) {
                // console.log('[DesktopModeManager] 检测到图标覆盖，批量恢复层级')
                this.windows.forEach(entry => {
                    this._setTop(entry.hwnd)
                })
            }
        } catch (err) {
            console.error('[DesktopModeManager] Error in checkAndRecover:', err)
        }
    },

    /**
     * 清理所有资源
     */
    cleanup(): void {
        this._stopTimer()
        this.windows = []
    }
}

// ============= 导出函数 =============

/**
 * Get native window handle as number from Electron BrowserWindow
 */
function getHwndAsNumber(win: BrowserWindow): number {
    const buf = win.getNativeWindowHandle()
    if (buf.length === 8) {
        return Number(buf.readBigUInt64LE(0))
    } else {
        return buf.readUInt32LE(0)
    }
}

/**
 * Attach a BrowserWindow to the desktop ABOVE the icon layer.
 * The window will persist through Win+D and render above desktop icons.
 * 
 * @param windowId - Unique identifier for tracking
 * @param hwndBuffer - Native window handle buffer from BrowserWindow.getNativeWindowHandle()
 * @param win - Optional BrowserWindow for focus tracking
 * @returns true if successful
 */
export function attachToDesktopAboveIcons(windowId: string, hwndBuffer: Buffer, win?: BrowserWindow): boolean {
    if (!initKoffi()) {
        console.warn('[DesktopAttach] Cannot attach - Koffi not available')
        return false
    }

    const { shellDefView, container } = findShellDefViewAndContainer()
    if (!shellDefView || !container) {
        console.warn('[DesktopAttach] SHELLDLL_DefView or its container not found')
        return false
    }

    // Convert buffer to number
    let hwnd: number
    if (hwndBuffer.length === 8) {
        hwnd = Number(hwndBuffer.readBigUInt64LE(0))
    } else {
        hwnd = hwndBuffer.readUInt32LE(0)
    }

    try {
        // Store container handle for this window
        containerHandles.set(windowId, container)

        // *** POSITION PRESERVATION: Get current screen position BEFORE changing parent ***
        const rect = { left: 0, top: 0, right: 0, bottom: 0 }
        GetWindowRect(hwnd, rect)
        const screenX = rect.left
        const screenY = rect.top
        const width = rect.right - rect.left
        const height = rect.bottom - rect.top

        // Convert screen coordinates to client coordinates of the container
        const point = { x: screenX, y: screenY }
        ScreenToClient(container, point)
        const clientX = point.x
        const clientY = point.y

        // *** Keep WS_POPUP style ***
        const currentStyle = GetWindowLongPtrW(hwnd, GWL_STYLE)
        const newStyle = (Number(currentStyle) | WS_VISIBLE) >>> 0
        SetWindowLongPtrW(hwnd, GWL_STYLE, newStyle)

        // Set parent to the CONTAINER
        SetParent(hwnd, container)

        // *** CRITICAL: Get container's screen position to calculate client coords ***
        // For parented WS_POPUP, SetWindowPos uses coordinates relative to parent's client area
        const containerRect = { left: 0, top: 0, right: 0, bottom: 0 }
        GetWindowRect(container, containerRect)

        // Convert screen coords to client coords: client = screen - container
        const targetClientX = screenX - containerRect.left
        const targetClientY = screenY - containerRect.top

        // SetWindowPos with CLIENT coordinates relative to parent
        SetWindowPos(hwnd, HWND_TOP, targetClientX, targetClientY, width, height,
            SWP_SHOWWINDOW | SWP_NOACTIVATE)

        // 使用统一的多窗口管理器而非单独定时器
        DesktopModeManager.add(windowId, hwnd, win)

        return true
    } catch (err) {
        console.error('[DesktopAttach] Failed to attach window above icons:', err)
        return false
    }
}

/**
 * Attach a BrowserWindow to the desktop shell - LEGACY compatibility wrapper
 */
export function attachToDesktop(windowId: string, hwndBuffer: Buffer): boolean {
    return attachToDesktopAboveIcons(windowId, hwndBuffer)
}

/**
 * Detach a BrowserWindow from the desktop shell (restore to normal floating mode)
 */
export function detachFromDesktop(windowId: string, hwndBuffer: Buffer): boolean {
    if (!initKoffi()) {
        return false
    }

    // Convert buffer to number
    let hwnd: number
    if (hwndBuffer.length === 8) {
        hwnd = Number(hwndBuffer.readBigUInt64LE(0))
    } else {
        hwnd = hwndBuffer.readUInt32LE(0)
    }

    try {
        // 从多窗口管理器移除
        DesktopModeManager.remove(windowId)

        // *** POSITION PRESERVATION: Get current screen position BEFORE changing parent ***
        const rect = { left: 0, top: 0, right: 0, bottom: 0 }
        GetWindowRect(hwnd, rect)
        const screenX = rect.left
        const screenY = rect.top
        const width = rect.right - rect.left
        const height = rect.bottom - rect.top

        // Since we kept WS_POPUP, just need to reset parent
        // No style changes needed

        // Set parent to NULL (desktop/no parent)
        SetParent(hwnd, 0)

        // Clean up tracking
        containerHandles.delete(windowId)

        // Just ensure visible and update Z-order
        SetWindowPos(hwnd, 0, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_NOACTIVATE | SWP_NOZORDER)

        return true
    } catch (err) {
        console.error('[DesktopAttach] Failed to detach window:', err)
        return false
    }
}

/**
 * Check if the desktop attach feature is available
 */
export function isDesktopAttachAvailable(): boolean {
    return initKoffi()
}

/**
 * Toggle desktop mode for a BrowserWindow
 */
export function toggleDesktopMode(windowId: string, win: BrowserWindow, enable: boolean): boolean {
    if (win.isDestroyed()) return false

    const hwnd = win.getNativeWindowHandle()

    if (enable) {
        return attachToDesktopAboveIcons(windowId, hwnd, win)
    } else {
        return detachFromDesktop(windowId, hwnd)
    }
}

/**
 * Bring a specific window to front in the desktop mode
 */
export function bringWindowToFront(windowId: string): void {
    DesktopModeManager.bringToFront(windowId)
}

/**
 * Clean up all resources (call on app quit)
 */
export function cleanupAllIntervals(): void {
    DesktopModeManager.cleanup()
}
