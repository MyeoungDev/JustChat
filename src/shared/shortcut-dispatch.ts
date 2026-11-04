import { acceleratorFromKeyChord, type KeyboardChord } from './settings'
import type { WindowMode } from './window-layout'

export interface ShortcutDispatchContext {
  eventType: string
  settingsVisible: boolean
  windowVisible: boolean
  windowFocused: boolean
  windowMode: WindowMode
}

export function shouldDispatchFocusedShortcut(
  chord: KeyboardChord,
  platform: string,
  configuredAccelerator: string,
  context: ShortcutDispatchContext
): boolean {
  if (context.eventType !== 'keyDown' || context.settingsVisible || !context.windowVisible || !context.windowFocused || context.windowMode !== 'popover') return false
  return acceleratorFromKeyChord(chord, platform) === configuredAccelerator
}
