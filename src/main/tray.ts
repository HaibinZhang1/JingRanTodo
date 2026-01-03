import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import path from 'path'
import { toggleCapsule } from './capsuleWindow'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow) {
    try {
        // 尝试多个可能的路径
        const paths = [
            path.join(process.resourcesPath, 'icon.ico'),
            path.join(process.resourcesPath, 'icon.png'),
            path.join(__dirname, '../../public/icon.ico'),
            path.join(__dirname, '../../public/icon.png'),
            path.join(__dirname, '../../public/icon.svg'),
            path.join(app.getAppPath(), 'public/icon.ico'),
            path.join(app.getAppPath(), 'public/icon.png'),
            path.join(app.getAppPath(), 'public/icon.svg')
        ]

        let iconPath = ''
        for (const p of paths) {
            try {
                const image = nativeImage.createFromPath(p)
                if (!image.isEmpty()) {
                    iconPath = p
                    break
                }
            } catch (e) {
                // Ignore invalid paths
            }
        }

        if (iconPath) {
            tray = new Tray(iconPath)
        } else {
            console.error('Tray icon not found, tray will not be created.')
            return null
        }
    } catch (e) {
        console.error('Failed to create tray:', e)
        return null
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '闪念胶囊',
            accelerator: 'Alt+Space',
            click: () => {
                toggleCapsule()
            }
        },
        {
            label: '显示主窗口',
            accelerator: 'Ctrl+Shift+Z',
            click: () => {
                mainWindow.show()
                mainWindow.focus()
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit()
            }
        }
    ])

    if (tray) {
        tray.setToolTip('井然')
        tray.setContextMenu(contextMenu)

        tray.on('double-click', () => {
            mainWindow.show()
            mainWindow.focus()
        })
    }

    return tray
}
