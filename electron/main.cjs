const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')

function getAppIcon() {
  const candidates = [
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(__dirname, '../dist/icon.ico'),
  ]
  return candidates.find((p) => fs.existsSync(p)) || undefined
}

// Single-instance lock: if user launches again, focus the existing window instead of silent exit
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Live Cloudflare Workers/Pages station URL (used for sync / fallback)
const CLOUD_STATION_URL = 'https://pharmacy-pos.ellahabad.workers.dev/'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 800,
    minHeight: 550,
    title: 'System Optix Pharmacy Station',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: getAppIcon(),
    show: false,
  })

  // External links open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Load local bundled station immediately (lightning-fast 50ms startup, works 100% offline)
    const localIndexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(localIndexPath, { hash: '/' }).catch((err) => {
      console.warn('Local bundle load failed, falling back to cloud station:', err)
      mainWindow.loadURL(CLOUD_STATION_URL)
    })
  }

  // Show window as soon as content is ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize()
      mainWindow.show()
    }
  })

  // Fail-safe: ensure the window ALWAYS appears within 1 second even if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.maximize()
      mainWindow.show()
    }
  }, 1000)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Thermal POS receipt direct printing IPC
ipcMain.handle('print-receipt', async (event, content) => {
  if (!mainWindow) return { success: false, error: 'No active window' }
  try {
    mainWindow.webContents.print(
      {
        silent: true,
        printBackground: true,
      },
      (success, failureReason) => {
        if (!success) console.warn('Print failed:', failureReason)
      }
    )
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
