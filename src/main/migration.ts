import { app } from 'electron'
import { join } from 'path'
import { existsSync, cpSync, rmSync, mkdirSync } from 'fs'

/**
 * Checks for data from the previous 'zenhubboard' application and migrates it to the current 'jingrantodo' location.
 * This should be called BEFORE database or other services initialization.
 */
export function checkAndMigrateData() {
    try {
        const appData = app.getPath('appData')
        const oldPath = join(appData, 'zenhubboard') // Old app name
        const newPath = app.getPath('userData') // Current app data path (which will be 'jingrantodo' based on package name)

        console.log('[Migration] Checking for migration...')
        console.log('[Migration] Old Path:', oldPath)
        console.log('[Migration] New Path:', newPath)

        // 1. Check if old data exists
        if (!existsSync(oldPath)) {
            console.log('[Migration] No old data found. Skipping.')
            return
        }

        // 2. Check if new data already exists (avoid overwriting if user has already started using new app)
        // We check for 'data' directory or 'zenhubboard.sqlite' specifically to be sure we are not overwriting a fresh install that has done nothing
        // But if it's a fresh install, 'userData' might automatically be created by Electron.
        // Let's check if 'data/zenhubboard.sqlite' exists in the new path.
        const newDbPath = join(newPath, 'data', 'zenhubboard.sqlite')
        if (existsSync(newDbPath)) {
            console.log('[Migration] New database already exists. Skipping migration to prevent data loss.')
            return
        }

        console.log('[Migration] Starting migration from', oldPath, 'to', newPath)

        // 3. Ensure new directory exists
        if (!existsSync(newPath)) {
            mkdirSync(newPath, { recursive: true })
        }

        // 4. Copy data recursively
        // We copy the content of oldPath into newPath
        // Note: cpSync with recursive: true copies the directory itself if destination is a directory?
        // Let's copy children.
        cpSync(oldPath, newPath, { recursive: true, force: true })

        console.log('[Migration] Copy completed verification...')

        // 5. Verification: Check if db exists in new path
        if (existsSync(newDbPath)) {
            console.log('[Migration] Verification successful. Deleting old data...')
            // 6. Delete old data
            // Retrying deletion if it fails (e.g. file lock), though in main process start it should be fine.
            try {
                rmSync(oldPath, { recursive: true, force: true })
                console.log('[Migration] Old data deleted.')
            } catch (deleteErr) {
                console.error('[Migration] Failed to delete old data (user might need to delete manually):', deleteErr)
            }
        } else {
            console.error('[Migration] Verification failed! New database not found after copy. Aborting deletion.')
        }

    } catch (err) {
        console.error('[Migration] Critical error during migration:', err)
    }
}
