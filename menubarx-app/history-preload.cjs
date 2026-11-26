const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('historyApp', {
  platform: process.platform,
  state: () => ipcRenderer.invoke('history:state'),
  action: (id, action) => ipcRenderer.invoke('history:action', id, action),
  onState: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('history:state', listener)
    return () => ipcRenderer.removeListener('history:state', listener)
  }
})
