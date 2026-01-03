import { globalShortcut, BrowserWindow, webContents } from 'electron'
import { toggleCapsule } from './capsuleWindow'
import { showNoteInputWindow } from './noteInputWindow'

export interface ShortcutsConfig {
    toggleMainWindow: string
    toggleCapsule: string
    createStickyNote: string
}

let currentConfig: ShortcutsConfig | null = null

export function registerShortcuts(mainWindow: BrowserWindow, config: ShortcutsConfig) {
    // Unregister all previous shortcuts
    globalShortcut.unregisterAll()

    currentConfig = config

    // Toggle Capsule
    if (config.toggleCapsule) {
        try {
            const ret = globalShortcut.register(config.toggleCapsule, () => {
                toggleCapsule()
            })
            if (!ret) {
                console.error(`[Shortcuts] Registration failed for toggleCapsule: ${config.toggleCapsule}`)
            } else {
                console.log(`[Shortcuts] Registered toggleCapsule: ${config.toggleCapsule}`)
            }
        } catch (e) {
            console.error(`[Shortcuts] Exception registering toggleCapsule: ${config.toggleCapsule}`, e)
        }
    }

    // Toggle Main Window
    if (config.toggleMainWindow) {
        try {
            const ret = globalShortcut.register(config.toggleMainWindow, () => {
                if (mainWindow.isVisible()) {
                    if (mainWindow.isFocused()) {
                        mainWindow.hide()
                    } else {
                        mainWindow.show()
                        mainWindow.focus()
                    }
                } else {
                    mainWindow.show()
                    mainWindow.focus()
                }
            })
            if (!ret) {
                console.error(`[Shortcuts] Registration failed for toggleMainWindow: ${config.toggleMainWindow}`)
            } else {
                console.log(`[Shortcuts] Registered toggleMainWindow: ${config.toggleMainWindow}`)
            }
        } catch (e) {
            console.error(`[Shortcuts] Exception registering toggleMainWindow: ${config.toggleMainWindow}`, e)
        }
    }

    // Create Sticky Note
    if (config.createStickyNote) {
        try {
            const ret = globalShortcut.register(config.createStickyNote, () => {
                showNoteInputWindow()
            })
            if (!ret) {
                console.error(`[Shortcuts] Registration failed for createStickyNote: ${config.createStickyNote}`)
            } else {
                console.log(`[Shortcuts] Registered createStickyNote: ${config.createStickyNote}`)
            }
        } catch (e) {
            console.error(`[Shortcuts] Exception registering createStickyNote: ${config.createStickyNote}`, e)
        }
    }
}

export function unregisterShortcuts() {
    globalShortcut.unregisterAll()
}

/**
 * Check if shortcuts are currently registered
 * Useful for debugging in production
 */
export function getShortcutStatus(): { config: ShortcutsConfig | null; registered: { [key: string]: boolean } } {
    const registered: { [key: string]: boolean } = {}
    if (currentConfig) {
        if (currentConfig.toggleCapsule) {
            registered.toggleCapsule = globalShortcut.isRegistered(currentConfig.toggleCapsule)
        }
        if (currentConfig.toggleMainWindow) {
            registered.toggleMainWindow = globalShortcut.isRegistered(currentConfig.toggleMainWindow)
        }
        if (currentConfig.createStickyNote) {
            registered.createStickyNote = globalShortcut.isRegistered(currentConfig.createStickyNote)
        }
    }
    return { config: currentConfig, registered }
}
