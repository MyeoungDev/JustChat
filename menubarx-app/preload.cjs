const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('browserApp', {
  platform: process.platform,
  switchWorkspace: (workspace) => ipcRenderer.invoke('workspace:switch', workspace),
  workspaceState: () => ipcRenderer.invoke('workspace:state'),
  activateWorkspaceBrowserTab: (id) => ipcRenderer.invoke('workspace:activate-browser-tab', id),
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
  findInPage: (query, direction) => ipcRenderer.invoke('tab:find', query, direction),
  closeFind: () => ipcRenderer.invoke('tab:find-close'),
  showMenu: () => ipcRenderer.invoke('browser:menu'),
  openHistory: () => ipcRenderer.invoke('history:open'),
  showSettings: () => ipcRenderer.invoke('settings:open'),
  setRefreshInterval: (seconds) => ipcRenderer.invoke('tab:refresh-interval', seconds),
  zoom: (delta) => ipcRenderer.invoke('tab:zoom', delta),
  resetZoom: () => ipcRenderer.invoke('tab:zoom-reset'),
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  hide: () => ipcRenderer.invoke('window:hide'),
  toggleSize: () => ipcRenderer.invoke('window:toggle-size'),
  toggleScreenFill: () => ipcRenderer.invoke('window:toggle-screen-fill'),
  saveWindowPreset: (index, name) => ipcRenderer.invoke('window:preset-save', index, name),
  restoreWindowPreset: (index) => ipcRenderer.invoke('window:preset-restore', index),
  resetWindowPresets: () => ipcRenderer.invoke('window:preset-reset'),
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
  },
  onFindResult: (callback) => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('app:find-result', listener)
    return () => ipcRenderer.removeListener('app:find-result', listener)
  },
  onFindClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:close-find', listener)
    return () => ipcRenderer.removeListener('app:close-find', listener)
  },
  ...(process.env.FLOA_UI_TEST === '1' ? {
    testRebuildMainWindow: () => ipcRenderer.invoke('test:rebuild-main-window'),
    testResizeWindow: (width, height) => ipcRenderer.invoke('test:resize-window', width, height),
    testDispatchKey: (input) => ipcRenderer.invoke('test:dispatch-key', input)
  } : {})
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
