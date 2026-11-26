const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mirrorApp', {
  platform: process.platform,
  sources: () => ipcRenderer.invoke('mirror:sources'),
  authorizeSource: (id) => ipcRenderer.invoke('mirror:authorize-source', id),
  selectSource: (id) => ipcRenderer.invoke('mirror:select-source', id),
  revokeSource: (id) => ipcRenderer.invoke('mirror:revoke-source', id),
  accessibility: () => ipcRenderer.invoke('mirror:accessibility'),
  setInteraction: (id, enabled) => ipcRenderer.invoke('mirror:set-interaction', id, enabled),
  raiseOriginal: (id) => ipcRenderer.invoke('mirror:raise-original', id),
  sendInput: (id, input) => ipcRenderer.invoke('mirror:input', id, input),
  openAccessibilitySettings: () => ipcRenderer.invoke('mirror:open-accessibility-settings'),
  openScreenSettings: () => ipcRenderer.invoke('mirror:open-screen-settings'),
  close: () => ipcRenderer.invoke('mirror:close'),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('mirror:command', listener)
    return () => ipcRenderer.removeListener('mirror:command', listener)
  }
})
