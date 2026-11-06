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
  ['full screen mode', { ...focusedContext, windowMode: 'fullscreen' }]
]

describe('focused popover temporary-chat shortcut', () => {
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
    expect(shouldDispatchFocusedShortcut(controlShiftN, 'win32', 'Control+Shift+N', { ...focusedContext, windowMode: 'expanded' })).toBe(true)
  })

  it('works in both compact and expanded popover sizes', () => {
    expect(shouldDispatchFocusedShortcut(temporaryChatChord, 'darwin', 'Command+Shift+N', focusedContext)).toBe(true)
    expect(shouldDispatchFocusedShortcut(temporaryChatChord, 'darwin', 'Command+Shift+N', { ...focusedContext, windowMode: 'expanded' })).toBe(true)
  })
})

describe('focused window-size shortcut', () => {
  const sizeChord = { key: 'E', code: 'KeyE', altKey: false, ctrlKey: false, metaKey: true, shiftKey: true }

  it('matches the configurable size shortcut in compact and expanded modes only', () => {
    expect(shouldDispatchFocusedShortcut(sizeChord, 'darwin', 'Command+Shift+E', focusedContext)).toBe(true)
    expect(shouldDispatchFocusedShortcut(sizeChord, 'darwin', 'Command+Shift+E', { ...focusedContext, windowMode: 'expanded' })).toBe(true)
    for (const [label, context] of rejectedContexts) {
      expect(shouldDispatchFocusedShortcut(sizeChord, 'darwin', 'Command+Shift+E', context), label).toBe(false)
    }
  })
})

describe('focused fullscreen shortcut', () => {
  const fullscreenChord = { key: 'F', code: 'KeyF', altKey: false, ctrlKey: false, metaKey: true, shiftKey: true }

  it('enters or exits fullscreen only while Just Chat is focused and visible', () => {
    expect(shouldDispatchFocusedShortcut(fullscreenChord, 'darwin', 'Command+Shift+F', focusedContext, ['compact', 'expanded', 'fullscreen'])).toBe(true)
    expect(shouldDispatchFocusedShortcut(fullscreenChord, 'darwin', 'Command+Shift+F', { ...focusedContext, windowMode: 'expanded' }, ['compact', 'expanded', 'fullscreen'])).toBe(true)
    expect(shouldDispatchFocusedShortcut(fullscreenChord, 'darwin', 'Command+Shift+F', { ...focusedContext, windowMode: 'fullscreen' }, ['compact', 'expanded', 'fullscreen'])).toBe(true)
    expect(shouldDispatchFocusedShortcut(fullscreenChord, 'darwin', 'Command+Shift+F', { ...focusedContext, windowMode: 'popover' }, ['compact', 'expanded', 'fullscreen'])).toBe(false)
    for (const [label, context] of rejectedContexts.filter(([label]) => label !== 'full screen mode')) {
      expect(shouldDispatchFocusedShortcut(fullscreenChord, 'darwin', 'Command+Shift+F', context, ['compact', 'expanded', 'fullscreen']), label).toBe(false)
    }
  })
})
