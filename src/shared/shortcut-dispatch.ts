import { acceleratorFromKeyChord, isReservedProviderShortcut, normalizeAccelerator, type KeyboardChord } from './settings'
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
  context: ShortcutDispatchContext,
  allowedModes: WindowMode[] = ['compact', 'expanded']
): boolean {
  if (context.eventType !== 'keyDown' || chord.isAutoRepeat || chord.isComposing
    || context.settingsVisible || !context.windowVisible || !context.windowFocused) return false
  if (!allowedModes.includes(context.windowMode)) return false
  const received = acceleratorFromKeyChord(chord, platform)
  const normalizedReceived = received ? normalizeAccelerator(received) : undefined
  const normalizedConfigured = normalizeAccelerator(configuredAccelerator)
  if (isReservedProviderShortcut(configuredAccelerator, platform)) return false
  return Boolean(normalizedReceived && normalizedConfigured && normalizedReceived === normalizedConfigured)
}
