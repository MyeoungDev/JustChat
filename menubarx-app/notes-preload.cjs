const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notesApp', {
  state: () => ipcRenderer.invoke('notes:state'),
  create: (sourceId) => ipcRenderer.invoke('notes:create', sourceId),
  update: (id, note) => ipcRenderer.invoke('notes:update', id, note),
  recognizeImage: (imageDataUrl) => ipcRenderer.invoke('notes:ocr-image', imageDataUrl),
  saveSync: (id, note) => ipcRenderer.sendSync('notes:save-sync', id, note),
  delete: (id) => ipcRenderer.invoke('notes:delete', id),
  onState: (callback) => {
    const listener = (_event, notes) => callback(notes)
    ipcRenderer.on('notes:state', listener)
    return () => ipcRenderer.removeListener('notes:state', listener)
  },
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('notes:command', listener)
    return () => ipcRenderer.removeListener('notes:command', listener)
  }
})
