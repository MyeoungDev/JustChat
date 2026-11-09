import { describe, expect, it } from 'vitest'
import { boundsAnchoredAtBottom, boundsForDisplay, clampWindowBounds, centeredBounds, geometryForCurrentDisplay, lowerCenteredBounds, modeForProviderPage, rememberDisplayBounds, transitionWindowGeometry, type WindowBounds } from './window-layout'

const display = { x: -1440, y: 0, width: 1440, height: 900 }

describe('window geometry', () => {
  it('opens a compact Quick Chat view from Pop Over and preserves larger modes', () => {
    expect(modeForProviderPage('popover')).toBe('compact')
    expect(modeForProviderPage('expanded')).toBe('expanded')
    expect(modeForProviderPage('fullscreen')).toBe('fullscreen')
  })

  it('uses saved mode geometry only when it belongs to the current display', () => {
    const savedOnPrimary = { x: 200, y: 100, width: 1200, height: 800 }
    const geometry = { popover: { x: -1000, y: 80, width: 460, height: 640 }, expanded: savedOnPrimary }
    expect(geometryForCurrentDisplay(geometry, 'expanded', false).expanded).toBeUndefined()
    expect(geometryForCurrentDisplay(geometry, 'expanded', true).expanded).toEqual(savedOnPrimary)
  })

  it('clamps a saved window onto a monitor with negative coordinates', () => {
    expect(clampWindowBounds({ x: -3000, y: 700, width: 460, height: 640 }, display, 'popover'))
      .toEqual({ x: -1440, y: 260, width: 700, height: 640 })
  })

  it('fits a window to a display smaller than its minimum', () => {
    expect(clampWindowBounds({ x: 20, y: 20, width: 1200, height: 800 }, { x: 0, y: 0, width: 700, height: 500 }, 'expanded'))
      .toEqual({ x: 0, y: 0, width: 700, height: 500 })
  })

  it('uses the active display work area for full-screen mode', () => {
    expect(centeredBounds('fullscreen', display)).toEqual(display)
  })

  it('starts with a readable ChatGPT popover size', () => {
    expect(centeredBounds('popover', display)).toEqual({ x: -1170, y: 150, width: 900, height: 600 })
  })

  it('provides a smaller Quick Chat mode and minimum size', () => {
    expect(centeredBounds('compact', display)).toEqual({ x: -980, y: 290, width: 520, height: 320 })
    expect(clampWindowBounds({ x: -1000, y: 100, width: 460, height: 160 }, display, 'compact'))
      .toEqual({ x: -1000, y: 100, width: 480, height: 180 })
  })

  it('uses the same default Expanded size on every display', () => {
    const laptop = { x: 0, y: 0, width: 1512, height: 900 }
    const largeMonitor = { x: 0, y: 0, width: 2560, height: 1440 }
    expect(centeredBounds('expanded', laptop)).toEqual({ x: 496, y: 210, width: 520, height: 480 })
    expect(centeredBounds('expanded', largeMonitor)).toEqual({ x: 1020, y: 480, width: 520, height: 480 })
  })

  it('preserves the user-saved Expanded size across displays', () => {
    const laptop = { x: 0, y: 0, width: 1512, height: 900 }
    expect(boundsForDisplay('expanded', { x: 496, y: 100, width: 520, height: 480 }, laptop))
      .toEqual({ x: 496, y: 100, width: 520, height: 480 })
    expect(lowerCenteredBounds('expanded', laptop, { x: 496, y: 100, width: 700, height: 600 }))
      .toEqual({ x: 406, y: 237, width: 700, height: 600 })
  })

  it('grows the conversation window upward while keeping its lower edge in place', () => {
    const current = { x: 400, y: 640, width: 520, height: 200 }
    const target = { x: 220, y: 100, width: 1000, height: 700 }
    expect(boundsAnchoredAtBottom(current, target, { x: 0, y: 0, width: 1440, height: 900 }))
      .toEqual({ x: 160, y: 140, width: 1000, height: 700 })
  })

  it('uses the cursor display fallback when there is no geometry saved for that display', () => {
    expect(boundsForDisplay('compact', undefined, { x: 0, y: 0, width: 1440, height: 900 }))
      .toEqual({ x: 460, y: 290, width: 520, height: 320 })
    expect(boundsForDisplay('compact', { x: -1200, y: 100, width: 760, height: 320 }, display))
      .toEqual({ x: -1200, y: 100, width: 760, height: 320 })
  })

  it('keeps saved window bounds independently for each display and mode', () => {
    const primary = { x: 100, y: 120, width: 560, height: 200 }
    const secondary = { x: -1300, y: 80, width: 560, height: 200 }
    const first = rememberDisplayBounds({}, 'compact', 'primary', primary)
    const both = rememberDisplayBounds(first, 'compact', 'secondary', secondary)
    expect(both.compact).toEqual({ primary, secondary })
    expect(rememberDisplayBounds(both, 'expanded', 'primary', { ...primary, height: 700 }).compact).toEqual({ primary, secondary })
  })

  it('upgrades old short popover geometry to the readable minimum', () => {
    expect(clampWindowBounds({ x: -1000, y: 100, width: 900, height: 220 }, display, 'popover'))
      .toEqual({ x: -1000, y: 100, width: 900, height: 600 })
  })

  it('remembers the user-sized expanded window when collapsing and expanding again', () => {
    const userSize: WindowBounds = { x: -1320, y: 40, width: 1000, height: 760 }
    const collapsed = transitionWindowGeometry('expanded', userSize, 'popover', {}, display, centeredBounds('popover', display))
    const expanded = transitionWindowGeometry('popover', collapsed.bounds, 'expanded', collapsed.geometry, display, centeredBounds('expanded', display))
    expect(expanded.bounds).toEqual(userSize)
  })
})
