const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('browserApp', {
  state: () => ipcRenderer.invoke('app:state'),
  navigate: (value) => ipcRenderer.invoke('tab:navigate', value),
  newTab: (value) => ipcRenderer.invoke('tab:new', value),
  activateTab: (id) => ipcRenderer.invoke('tab:activate', id),
  closeTab: (id) => ipcRenderer.invoke('tab:close', id),
  back: () => ipcRenderer.invoke('tab:back'),
  forward: () => ipcRenderer.invoke('tab:forward'),
  reload: () => ipcRenderer.invoke('tab:reload'),
  hardReload: () => ipcRenderer.invoke('tab:hard-reload'),
  closeCurrent: () => ipcRenderer.invoke('tab:close-current'),
  home: () => ipcRenderer.invoke('tab:home'),
  toggleMute: () => ipcRenderer.invoke('tab:toggle-mute'),
  showMenu: () => ipcRenderer.invoke('browser:menu'),
  showSettings: () => ipcRenderer.invoke('settings:open'),
  setRefreshInterval: (seconds) => ipcRenderer.invoke('tab:refresh-interval', seconds),
  zoom: (delta) => ipcRenderer.invoke('tab:zoom', delta),
  resetZoom: () => ipcRenderer.invoke('tab:zoom-reset'),
  toggleTabDetachment: (id) => ipcRenderer.invoke('tab:detach', id),
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  hide: () => ipcRenderer.invoke('window:hide'),
  addBookmark: () => ipcRenderer.invoke('bookmark:add'),
  openBookmark: (url) => ipcRenderer.invoke('bookmark:open', url),
  removeBookmark: (url) => ipcRenderer.invoke('bookmark:remove', url),
  saveBookmark: (item) => ipcRenderer.invoke('bookmark:save', item),
  moveBookmark: (url, offset) => ipcRenderer.invoke('bookmark:move', url, offset),
  onState: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('app:state-changed', listener)
    return () => ipcRenderer.removeListener('app:state-changed', listener)
  },
  onNavigateError: (callback) => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('app:navigate-error', listener)
    return () => ipcRenderer.removeListener('app:navigate-error', listener)
  },
  onDownloadStatus: (callback) => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('app:download-status', listener)
    return () => ipcRenderer.removeListener('app:download-status', listener)
  }
})

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
  }
})
