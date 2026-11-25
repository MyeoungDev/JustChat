const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('downloadsApp', {
  state: () => ipcRenderer.invoke('downloads:state'),
  action: (id, action) => ipcRenderer.invoke('downloads:action', id, action),
  onState: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on('downloads:state', listener); return () => ipcRenderer.removeListener('downloads:state', listener) }
})
