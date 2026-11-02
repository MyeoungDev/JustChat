import { contextBridge, ipcRenderer } from 'electron'
import type { ProviderId } from '../shared/providers'
import type { AppSettings } from '../shared/settings'
import type { WindowMode } from '../shared/window-layout'

export interface ShellState {
  mode: WindowMode
  providerId: ProviderId
  providerState: 'loading' | 'ready' | 'error'
  settingsVisible: boolean
  chatViewVisible: boolean
  settings: AppSettings
  shortcutFailures: string[]
}

contextBridge.exposeInMainWorld('justChat', {
  expand: () => ipcRenderer.send('app:expand'),
  collapse: () => ipcRenderer.send('app:collapse'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
  hide: () => ipcRenderer.send('app:hide'),
  showSettings: (visible: boolean) => ipcRenderer.send('app:settings', visible),
  retryProvider: () => ipcRenderer.send('app:retry-provider'),
  submitPrompt: (prompt: string) => ipcRenderer.invoke('chat:submit-prompt', prompt) as Promise<{ ok: boolean; reason?: string }>,
  openChatManually: (prompt: string) => ipcRenderer.invoke('chat:open-manually', prompt) as Promise<{ ok: boolean; reason?: string }>,
  showComposer: () => ipcRenderer.send('chat:show-composer'),
  selectProvider: (provider: ProviderId) => ipcRenderer.send('app:provider', provider),
  getState: () => ipcRenderer.invoke('shell:get-state') as Promise<ShellState | null>,
  updateSettings: (patch: Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'resetAfterMinutes'>>) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<{ ok: boolean; settings?: AppSettings; failures?: string[]; reason?: string }>,
  onState: (callback: (state: ShellState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ShellState) => callback(state)
    ipcRenderer.on('shell:state', listener)
    return () => ipcRenderer.removeListener('shell:state', listener)
  },
  platform: process.platform
})
