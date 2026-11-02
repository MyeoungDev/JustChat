import { describe, expect, it } from 'vitest'
import { acceleratorFromKeyChord, defaultSettings, isValidAccelerator, normalizeSettings, validateShortcutMap } from './settings'

describe('settings', () => {
  it('provides platform-specific default shortcuts', () => {
    expect(defaultSettings('darwin').shortcuts).toEqual({ toggle: 'Alt+Space', temporaryChat: 'Command+Shift+N', chatHistory: 'Command+K', providers: { chatgpt: 'Alt+1', claude: 'Alt+2' } })
    expect(defaultSettings('win32').shortcuts.toggle).toBe('Control+Shift+Space')
    expect(defaultSettings('win32').shortcuts.temporaryChat).toBe('Control+Shift+N')
    expect(defaultSettings('win32').shortcuts.chatHistory).toBe('Control+K')
    expect(defaultSettings('darwin').resetAfterMinutes).toBe(30)
  })

  it('normalizes corrupt or partial persisted values safely', () => {
    const settings = normalizeSettings({ alwaysOnTop: false, geometry: { popover: { x: -100, y: 4, width: 460, height: 640 } } }, 'darwin')
    expect(settings.alwaysOnTop).toBe(false)
    expect(settings.activeProviderId).toBe('chatgpt')
    expect(settings.geometry.popover).toEqual({ x: -320, y: 214, width: 900, height: 220 })
    expect(settings.shortcuts.toggle).toBe('Alt+Space')
  })

  it('accepts disabling the idle reset timer and falls back for unsupported values', () => {
    expect(normalizeSettings({ resetAfterMinutes: 0 }, 'darwin').resetAfterMinutes).toBe(0)
    expect(normalizeSettings({ resetAfterMinutes: 45 }, 'darwin').resetAfterMinutes).toBe(30)
  })

  it('validates accelerator grammar and duplicate bindings', () => {
    expect(isValidAccelerator('Alt+Space')).toBe(true)
    expect(isValidAccelerator('Space')).toBe(false)
    expect(isValidAccelerator('Control+Shift+F6')).toBe(true)
    expect(validateShortcutMap({ toggle: 'Alt+Space', 'temporary-chat': 'Alt+Space', 'provider:claude': 'Alt+2' }))
      .toEqual(['temporary-chat:duplicate:toggle'])
  })

  it('builds a shortcut from captured keyboard input', () => {
    expect(acceleratorFromKeyChord({ key: ' ', code: 'Space', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }, 'darwin'))
      .toBe('Alt+Space')
    expect(acceleratorFromKeyChord({ key: '1', code: 'Digit1', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true }, 'win32'))
      .toBe('Control+Shift+1')
  })
})
