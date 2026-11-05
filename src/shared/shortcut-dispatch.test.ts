import { describe, expect, it } from 'vitest'
import { shouldDispatchFocusedShortcut, type ShortcutDispatchContext } from './shortcut-dispatch'

const focusedContext: ShortcutDispatchContext = {
  eventType: 'keyDown',
  settingsVisible: false,
  windowVisible: true,
  windowFocused: true,
  windowMode: 'compact'
}
const rejectedContexts: [string, ShortcutDispatchContext][] = [
  ['key up', { ...focusedContext, eventType: 'keyUp' }],
  ['settings visible', { ...focusedContext, settingsVisible: true }],
  ['window hidden', { ...focusedContext, windowVisible: false }],
  ['another app focused', { ...focusedContext, windowFocused: false }],
  ['pop over mode', { ...focusedContext, windowMode: 'popover' }],
  ['expanded mode', { ...focusedContext, windowMode: 'expanded' }],
  ['full screen mode', { ...focusedContext, windowMode: 'fullscreen' }]
]

describe('focused Quick Chat conversation search shortcut', () => {
  const commandK = { key: 'K', code: 'KeyK', altKey: false, ctrlKey: false, metaKey: true, shiftKey: false }

  it('matches Command+K only while Quick Chat is focused and visible', () => {
    expect(shouldDispatchFocusedShortcut(commandK, 'darwin', 'Command+K', focusedContext)).toBe(true)
    for (const [label, context] of rejectedContexts) {
      expect(shouldDispatchFocusedShortcut(commandK, 'darwin', 'Command+K', context), label).toBe(false)
    }
  })

  it('uses Control+K as the Windows in-app equivalent without global registration', () => {
    const controlK = { key: 'k', code: 'KeyK', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false }
    expect(shouldDispatchFocusedShortcut(controlK, 'win32', 'Control+K', focusedContext)).toBe(true)
    expect(shouldDispatchFocusedShortcut(controlK, 'win32', 'Control+K', { ...focusedContext, windowMode: 'expanded' })).toBe(false)
  })
})
