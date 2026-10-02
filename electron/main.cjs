const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')

// Disable hardware acceleration on Windows to eliminate GPU rasterization
// bugs, black/white flickers, and half-screen rendering glitches across different display drivers.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

// Live Cloudflare Workers/Pages station URL
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
    icon: path.join(__dirname, '../public/icon.ico'),
    show: false,
  })

  // External links open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Load Cloudflare station with automatic offline fallback
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Attempt connecting to the live Cloudflare Station
    mainWindow.loadURL(CLOUD_STATION_URL).catch((err) => {
      console.warn('Network unavailable, loading offline local station:', err)
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    })

    // Fallback gracefully to offline bundle if internet disconnects
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL && validatedURL.startsWith('http') && errorCode !== -3) {
        console.warn(`Connection failed (${errorCode}: ${errorDescription}). Switching to offline local station.`)
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
      }
    })
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

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
