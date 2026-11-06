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

describe('focused Quick Chat temporary-chat shortcut', () => {
  const temporaryChatChord = { key: 'N', code: 'KeyN', altKey: false, ctrlKey: false, metaKey: true, shiftKey: true }

  it('matches the configurable shortcut only while Quick Chat is focused and visible', () => {
    expect(shouldDispatchFocusedShortcut(temporaryChatChord, 'darwin', 'Command+Shift+N', focusedContext)).toBe(true)
    for (const [label, context] of rejectedContexts) {
      expect(shouldDispatchFocusedShortcut(temporaryChatChord, 'darwin', 'Command+Shift+N', context), label).toBe(false)
    }
  })

  it('uses Control+Shift+N as the Windows in-app equivalent without global registration', () => {
    const controlShiftN = { key: 'n', code: 'KeyN', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true }
    expect(shouldDispatchFocusedShortcut(controlShiftN, 'win32', 'Control+Shift+N', focusedContext)).toBe(true)
    expect(shouldDispatchFocusedShortcut(controlShiftN, 'win32', 'Control+Shift+N', { ...focusedContext, windowMode: 'expanded' })).toBe(false)
  })
})
