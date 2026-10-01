const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')

// Disable hardware acceleration on Windows to eliminate GPU rasterization
// bugs, black/white flickers, and half-screen rendering glitches across different display drivers.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

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
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false,
  })

  // Determine if running in dev mode or packaged app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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
