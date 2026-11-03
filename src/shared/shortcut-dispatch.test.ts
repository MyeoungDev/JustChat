import { describe, expect, it } from 'vitest'
import { routeTemporaryChatShortcut, type ShortcutDispatchContext } from './shortcut-dispatch'

const focusedContext: ShortcutDispatchContext = {
  eventType: 'keyDown',
  settingsVisible: false,
  windowVisible: true,
  windowFocused: true
}

describe('focused temporary-chat shortcut dispatch', () => {
  const macChord = { key: 'N', code: 'KeyN', altKey: false, ctrlKey: false, metaKey: true, shiftKey: true }

  it('matches the configured platform shortcut only on key down while the app is focused', () => {
    expect(routeTemporaryChatShortcut(macChord, 'darwin', 'Command+Shift+N', focusedContext, false)).toBe('just-chat')
    expect(routeTemporaryChatShortcut({ key: 'N', code: 'KeyN', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true }, 'win32', 'Control+Shift+N', focusedContext, false)).toBe('just-chat')
  })

  it.each([
    ['key up', { ...focusedContext, eventType: 'keyUp' }],
    ['settings visible', { ...focusedContext, settingsVisible: true }],
    ['window hidden', { ...focusedContext, windowVisible: false }],
    ['another app focused', { ...focusedContext, windowFocused: false }]
  ])('ignores input when %s', (_reason, context) => {
    expect(routeTemporaryChatShortcut(macChord, 'darwin', 'Command+Shift+N', context, false)).toBe('ignore')
  })

  it('ignores a chord that does not match the configured shortcut', () => {
    expect(routeTemporaryChatShortcut(macChord, 'darwin', 'Alt+N', focusedContext, false)).toBe('ignore')
  })

  it('lets ChatGPT handle its native temporary-chat chord when its WebView has focus', () => {
    expect(routeTemporaryChatShortcut(macChord, 'darwin', 'Command+Shift+N', focusedContext, true)).toBe('chatgpt')
    expect(routeTemporaryChatShortcut({ key: 'N', code: 'KeyN', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true }, 'win32', 'Control+Shift+N', focusedContext, true)).toBe('chatgpt')
    expect(routeTemporaryChatShortcut(macChord, 'darwin', 'Alt+N', focusedContext, true)).toBe('ignore')
  })

  it('routes a custom provider-focused shortcut through Just Chat to ChatGPT', () => {
    expect(routeTemporaryChatShortcut({ key: 'N', code: 'KeyN', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }, 'darwin', 'Alt+N', focusedContext, true)).toBe('just-chat')
  })
})
