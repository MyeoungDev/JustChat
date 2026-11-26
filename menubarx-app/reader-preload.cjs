const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('readerApp', {
  state: () => ipcRenderer.invoke('reader:state'),
  importDocument: () => ipcRenderer.invoke('reader:import'),
  loadDocument: (id) => ipcRenderer.invoke('reader:load', id),
  saveLocation: (id, state) => ipcRenderer.invoke('reader:save-location', id, state),
  addBookmark: (id, state) => ipcRenderer.invoke('reader:add-bookmark', id, state),
  addHighlight: (id, input) => ipcRenderer.invoke('reader:add-highlight', id, input),
  removeBookmark: (id, bookmarkId) => ipcRenderer.invoke('reader:remove-bookmark', id, bookmarkId),
  removeHighlight: (id, highlightId) => ipcRenderer.invoke('reader:remove-highlight', id, highlightId),
  removeDocument: (id) => ipcRenderer.invoke('reader:remove-document', id),
  onState: (callback) => { const listener = (_event, state) => callback(state); ipcRenderer.on('reader:state', listener); return () => ipcRenderer.removeListener('reader:state', listener) },
  onCommand: (callback) => { const listener = (_event, command) => callback(command); ipcRenderer.on('reader:command', listener); return () => ipcRenderer.removeListener('reader:command', listener) }
})
