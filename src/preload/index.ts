import { contextBridge, ipcRenderer } from 'electron'
import type { ProviderId } from '../shared/providers'
import type { AppSettings } from '../shared/settings'
import type { WindowMode } from '../shared/window-layout'

export interface ShellState {
  mode: WindowMode
  providerId: ProviderId
  providerState: 'loading' | 'ready' | 'error'
  settingsVisible: boolean
  settings: AppSettings
  shortcutFailures: string[]
}

export interface ClearChatGptSessionResult {
  ok: boolean
  cleared: boolean
  reason?: 'untrusted' | 'clear-failed' | 'reload-failed'
}

contextBridge.exposeInMainWorld('justChat', {
  expand: () => ipcRenderer.send('app:expand'),
  collapse: () => ipcRenderer.send('app:collapse'),
  compact: () => ipcRenderer.send('app:compact'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
  toggleWindowForPerformanceSample: () => ipcRenderer.invoke('performance:toggle-window') as Promise<{ event: 'show' | 'hide'; durationMs: number }>,
  hide: () => ipcRenderer.send('app:hide'),
  showSettings: (visible: boolean) => ipcRenderer.send('app:settings', visible),
  retryProvider: () => ipcRenderer.send('app:retry-provider'),
  selectProvider: (provider: ProviderId) => ipcRenderer.send('app:provider', provider),
  getState: () => ipcRenderer.invoke('shell:get-state') as Promise<ShellState | null>,
  updateSettings: (patch: Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'opacity' | 'theme' | 'opacityMode' | 'backgroundOpacity' | 'pageZoomPercent' | 'resetAfterMinutes' | 'notifyWhenChatGPTCompletesWhileHidden'>>) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<{ ok: boolean; settings?: AppSettings; failures?: string[]; reason?: string }>,
  clearChatGptSession: () => ipcRenderer.invoke('provider:clear-chatgpt-session') as Promise<ClearChatGptSessionResult>,
  onState: (callback: (state: ShellState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ShellState) => callback(state)
    ipcRenderer.on('shell:state', listener)
    return () => ipcRenderer.removeListener('shell:state', listener)
  },
  platform: process.platform
})
