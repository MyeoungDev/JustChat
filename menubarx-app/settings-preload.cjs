const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('settingsApp', {
  platform: process.platform,
  get: () => ipcRenderer.invoke('settings:state'),
  save: (values) => ipcRenderer.invoke('settings:save', values),
  reset: () => ipcRenderer.invoke('settings:reset'),
  close: () => ipcRenderer.invoke('settings:close'),
  chooseDownloadFolder: () => ipcRenderer.invoke('settings:choose-download-folder'),
  revokePermission: (origin, permission) => ipcRenderer.invoke('settings:revoke-site-permission', origin, permission),
  onPermissionsChanged: (callback) => {
    const listener = (_event, permissions) => callback(permissions)
    ipcRenderer.on('settings:permissions-changed', listener)
    return () => ipcRenderer.removeListener('settings:permissions-changed', listener)
  },
  onFocusShortcuts: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('settings:focus-shortcuts', listener)
    return () => ipcRenderer.removeListener('settings:focus-shortcuts', listener)
  }
})
