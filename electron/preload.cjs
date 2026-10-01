const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
})
