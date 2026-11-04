import { describe, expect, it } from 'vitest'
import { shouldDispatchFocusedShortcut, type ShortcutDispatchContext } from './shortcut-dispatch'

const focusedContext: ShortcutDispatchContext = {
  eventType: 'keyDown',
  settingsVisible: false,
  windowVisible: true,
  windowFocused: true,
  windowMode: 'popover'
}
const rejectedContexts: [string, ShortcutDispatchContext][] = [
  ['key up', { ...focusedContext, eventType: 'keyUp' }],
  ['settings visible', { ...focusedContext, settingsVisible: true }],
  ['window hidden', { ...focusedContext, windowVisible: false }],
  ['another app focused', { ...focusedContext, windowFocused: false }],
  ['expanded mode', { ...focusedContext, windowMode: 'expanded' }],
  ['full screen mode', { ...focusedContext, windowMode: 'fullscreen' }]
]

describe('focused ChatGPT conversation search shortcut', () => {
  const commandK = { key: 'K', code: 'KeyK', altKey: false, ctrlKey: false, metaKey: true, shiftKey: false }

  it('matches Command+K only while Just Chat is focused and visible', () => {
    expect(shouldDispatchFocusedShortcut(commandK, 'darwin', 'Command+K', focusedContext)).toBe(true)
    expect(shouldDispatchFocusedShortcut(commandK, 'darwin', 'Command+K', { ...focusedContext, windowFocused: false })).toBe(false)
    expect(shouldDispatchFocusedShortcut(commandK, 'darwin', 'Command+K', { ...focusedContext, windowVisible: false })).toBe(false)
  })
})
