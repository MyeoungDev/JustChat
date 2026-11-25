import { createRoot } from 'react-dom/client'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { AppSettings } from '../shared/settings'
import type { ProviderId } from '../shared/providers'
import type { ClearChatGptSessionResult, ShellState } from '../preload'
import { App } from './ui/App'

document.documentElement.dataset.tauriShell = 'true'

window.justChat = {
  expand: () => { void invoke('set_mode', { mode: 'expanded' }) },
  collapse: () => { void invoke('set_mode', { mode: 'compact' }) },
  compact: () => { void invoke('set_mode', { mode: 'compact' }) },
  toggleFullscreen: () => { void invoke('toggle_fullscreen') },
  dispatchShortcut: (chord: string) => invoke<boolean>('dispatch_shortcut', { chord }),
  hide: () => { void invoke('hide_window') },
  startDragging: () => { void invoke('start_dragging') },
  showSettings: (visible: boolean) => { void invoke('set_settings_visible', { visible }) },
  retryProvider: () => { void invoke('retry_provider') },
  selectProvider: (provider: ProviderId) => { void invoke('select_provider', { provider }) },
  getState: () => invoke<ShellState | null>('get_shell_state'),
  updateSettings: (patch: Partial<AppSettings>) => invoke<{ ok: boolean; settings?: AppSettings; failures?: string[]; reason?: string }>('update_settings', { patch }),
  clearChatGptSession: () => invoke<ClearChatGptSessionResult>('clear_chatgpt_session'),
  onState: (callback: (state: ShellState) => void) => {
    let unlisten: (() => void) | undefined
    void listen<ShellState>('shell-state', (event) => callback(event.payload)).then((stop) => { unlisten = stop })
    return () => { unlisten?.() }
  },
  platform: /Macintosh|Mac OS X/.test(navigator.userAgent) ? 'darwin' : 'win32'
}

createRoot(document.getElementById('root')!).render(<App />)
