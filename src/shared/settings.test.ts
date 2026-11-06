import { describe, expect, it } from 'vitest'
import { acceleratorFromKeyChord, defaultSettings, isValidAccelerator, normalizeSettings, pageZoomFactor, validateShortcutMap } from './settings'

describe('settings', () => {
  it('provides platform-specific default shortcuts', () => {
    expect(defaultSettings('darwin').shortcuts).toEqual({ toggle: 'Alt+Space', temporaryChat: 'Command+Shift+N', toggleSize: 'Command+Shift+E', toggleFullscreen: 'Command+Shift+F', providers: { chatgpt: 'Alt+1', claude: 'Alt+2' } })
    expect(defaultSettings('win32').shortcuts.toggle).toBe('Control+Shift+Space')
    expect(defaultSettings('win32').shortcuts.toggleSize).toBe('Control+Shift+E')
    expect(defaultSettings('win32').shortcuts.toggleFullscreen).toBe('Control+Shift+F')
    expect(defaultSettings('win32').shortcuts).not.toHaveProperty('chatHistory')
    expect(defaultSettings('darwin').resetAfterMinutes).toBe(30)
    expect(defaultSettings('darwin').pageZoomPercent).toBe(100)
    expect(pageZoomFactor(100)).toBeCloseTo(0.996)
  })

  it('normalizes corrupt or partial persisted values safely', () => {
    const settings = normalizeSettings({ alwaysOnTop: false, geometry: { popover: { x: -100, y: 4, width: 460, height: 640 } } }, 'darwin')
    expect(settings.alwaysOnTop).toBe(false)
    expect(settings.activeProviderId).toBe('chatgpt')
    expect(settings.geometry.popover).toEqual({ x: -320, y: 214, width: 900, height: 220 })
    expect(settings.shortcuts.toggle).toBe('Alt+Space')
  })

  it('restores valid per-display window geometry and ignores invalid entries', () => {
    const settings = normalizeSettings({
      geometryByDisplay: {
        compact: {
          'display-1': { x: -900, y: 40, width: 760, height: 320 },
          'display-bad': { x: 0, y: 0, width: Number.NaN, height: 320 }
        }
      }
    }, 'darwin')
    expect(settings.geometryByDisplay.compact).toEqual({
      'display-1': { x: -900, y: 40, width: 760, height: 320 }
    })
  })

  it('upgrades the previous default compact size while preserving custom sizes', () => {
    const settings = normalizeSettings({
      geometry: {
        compact: { x: 40, y: 60, width: 520, height: 200 },
        expanded: { x: 80, y: 90, width: 700, height: 500 }
      },
      geometryByDisplay: {
        compact: {
          'default-sized-display': { x: 40, y: 60, width: 520, height: 200 },
          'custom-sized-display': { x: 40, y: 60, width: 600, height: 240 }
        }
      }
    }, 'darwin')
    expect(settings.geometry.compact).toEqual({ x: 40, y: 60, width: 520, height: 320 })
    expect(settings.geometry.expanded).toEqual({ x: 80, y: 90, width: 700, height: 500 })
    expect(settings.geometryByDisplay.compact).toEqual({
      'default-sized-display': { x: 40, y: 60, width: 520, height: 320 },
      'custom-sized-display': { x: 40, y: 60, width: 600, height: 240 }
    })
  })

  it('accepts disabling the idle reset timer and falls back for unsupported values', () => {
    expect(normalizeSettings({ resetAfterMinutes: 0 }, 'darwin').resetAfterMinutes).toBe(0)
    expect(normalizeSettings({ resetAfterMinutes: 45 }, 'darwin').resetAfterMinutes).toBe(30)
  })

  it('keeps whole-window opacity and experimental background opacity independently', () => {
    const settings = normalizeSettings({ opacity: 0.75, opacityMode: 'background', backgroundOpacity: 0.8 }, 'darwin')
    expect(settings.opacity).toBe(0.75)
    expect(settings.opacityMode).toBe('background')
    expect(settings.backgroundOpacity).toBe(0.8)
    expect(normalizeSettings({ opacityMode: 'unknown', backgroundOpacity: 0.2 }, 'darwin')).toMatchObject({
      opacityMode: 'window',
      backgroundOpacity: 0.7
    })
  })

  it('normalizes the provider page zoom setting', () => {
    expect(normalizeSettings({ pageZoomPercent: 105.6, pageZoomScaleVersion: 3 }, 'darwin').pageZoomPercent).toBe(106)
    expect(normalizeSettings({ pageZoomPercent: 20, pageZoomScaleVersion: 3 }, 'darwin').pageZoomPercent).toBe(70)
    expect(normalizeSettings({ pageZoomPercent: Number.NaN }, 'darwin').pageZoomPercent).toBe(100)
    expect(normalizeSettings({ pageZoomPercent: 91 }, 'darwin').pageZoomPercent).toBe(83)
    expect(normalizeSettings({ pageZoomPercent: 83 }, 'darwin').pageZoomPercent).toBe(83)
    expect(normalizeSettings({ pageZoomPercent: 120, pageZoomScaleVersion: 2 }, 'darwin').pageZoomPercent).toBe(100)
  })

  it('restores only a valid ChatGPT conversation path', () => {
    expect(normalizeSettings({ lastChatGPTConversationPath: '/c/thread-123?secret=value' }, 'darwin').lastChatGPTConversationPath).toBe('/c/thread-123')
    expect(normalizeSettings({ lastChatGPTConversationPath: 'https://example.com/c/thread-123' }, 'darwin').lastChatGPTConversationPath).toBeUndefined()
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
