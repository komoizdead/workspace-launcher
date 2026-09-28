import path from 'path'
import { app, BrowserWindow, Menu, nativeImage, Tray, ipcMain, shell } from 'electron'
import type { NativeImage } from 'electron'
import {
  bindTray,
  getProfiles,
  getSettings,
  launchProfile,
  refreshHotkeysFromStore,
  registerIpcHandlers,
} from './IPC/storageHandler'

const DEV_URL = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(DEV_URL)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

/* ------------------------------ Window ---------------------------------- */

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Workspace Launcher',
    icon: path.join(app.getAppPath(), 'assets', 'icon.png'),
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
  })

  // Open external links in the system browser, never in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    const settings = getSettings()
    if (!isQuitting && settings.minimizeToTrayOnClose && tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (DEV_URL) {
    void mainWindow.loadURL(DEV_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

/* ------------------------------- Tray ----------------------------------- */

function buildTrayMenu(): void {
  if (!tray) return
  const profiles = getProfiles()
  const menu = Menu.buildFromTemplate([
    {
      label: 'Workspace Launcher',
      enabled: false,
    },
    { type: 'separator' },
    ...profiles.map((p) => ({
      label: `Launch: ${p.name}`,
      click: () => void launchProfile(p.id),
    })),
    ...(profiles.length ? [{ type: 'separator' } as const] : []),
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

const FALLBACK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function createTrayIcon(): NativeImage {
  const fromFile = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'tray.png'))
  if (!fromFile.isEmpty()) return fromFile
  return nativeImage.createFromDataURL(FALLBACK_ICON)
}

function createTray(): void {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Workspace Launcher')
  buildTrayMenu()
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
  bindTray(tray, buildTrayMenu)
}

/* ------------------------------ Lifecycle -------------------------------- */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    createWindow()
    createTray()
    refreshHotkeysFromStore()

    ipcMain.on('window:minimize-to-tray', () => mainWindow?.hide())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('will-quit', () => {
    // globalShortcut is unregistered automatically on will-quit; explicit for clarity
  })
}
