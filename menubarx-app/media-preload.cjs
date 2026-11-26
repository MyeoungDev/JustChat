const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mediaPlayer', {
  onOpen: (callback) => {
    const listener = (_event, media) => callback(media)
    ipcRenderer.on('media:open', listener)
    return () => ipcRenderer.removeListener('media:open', listener)
  },
  onVolume: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('media:volume', listener)
    return () => ipcRenderer.removeListener('media:volume', listener)
  },
  savePosition: (filePath, time) => ipcRenderer.send('media:save-position', filePath, time),
  savePositionSync: (filePath, time) => ipcRenderer.send('media:save-position-sync', filePath, time),
  setPlaying: (playing) => ipcRenderer.send('media:playing', playing),
  setVolume: (volume) => ipcRenderer.invoke('media:set-volume', volume),
  toggleMute: () => ipcRenderer.invoke('media:toggle-mute'),
  chooseVideo: () => ipcRenderer.invoke('media:choose-video')
})
