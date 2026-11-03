import { acceleratorFromKeyChord, type KeyboardChord } from './settings'

export interface ShortcutDispatchContext {
  eventType: string
  settingsVisible: boolean
  windowVisible: boolean
  windowFocused: boolean
}

export type TemporaryChatShortcutRoute = 'ignore' | 'chatgpt' | 'just-chat'

export function shouldDispatchFocusedShortcut(
  chord: KeyboardChord,
  platform: string,
  configuredAccelerator: string,
  context: ShortcutDispatchContext
): boolean {
  if (context.eventType !== 'keyDown' || context.settingsVisible || !context.windowVisible || !context.windowFocused) return false
  return acceleratorFromKeyChord(chord, platform) === configuredAccelerator
}

export function isNativeTemporaryChatShortcut(accelerator: string, platform: string): boolean {
  return accelerator === (platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N')
}

export function routeTemporaryChatShortcut(
  chord: KeyboardChord,
  platform: string,
  configuredAccelerator: string,
  context: ShortcutDispatchContext,
  providerHasFocus: boolean
): TemporaryChatShortcutRoute {
  if (!shouldDispatchFocusedShortcut(chord, platform, configuredAccelerator, context)) return 'ignore'
  if (providerHasFocus && isNativeTemporaryChatShortcut(configuredAccelerator, platform)) return 'chatgpt'
  return 'just-chat'
}
