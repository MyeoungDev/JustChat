import type { ProviderId } from '../shared/providers'
import type { AppSettings } from '../shared/settings'
import type { WindowMode } from '../shared/window-layout'
import type { ClearChatGptSessionResult, ShellState } from '../preload'

declare global {
  interface Window {
    justChat: {
      expand: () => void
      collapse: () => void
      toggleFullscreen: () => void
      hide: () => void
      showSettings: (visible: boolean) => void
      retryProvider: () => void
      submitPrompt: (prompt: string) => Promise<{ ok: boolean; reason?: string }>
      openChatManually: (prompt: string) => Promise<{ ok: boolean; reason?: string }>
      showComposer: () => void
      selectProvider: (provider: ProviderId) => void
      getState: () => Promise<ShellState | null>
      updateSettings: (patch: Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'resetAfterMinutes'>>) => Promise<{ ok: boolean; settings?: AppSettings; failures?: string[]; reason?: string }>
      clearChatGptSession: () => Promise<ClearChatGptSessionResult>
      onState: (callback: (state: ShellState) => void) => () => void
      platform: string
    }
  }
}

export {}
