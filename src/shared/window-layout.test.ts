import { describe, expect, it } from 'vitest'
import { clampWindowBounds, centeredBounds, geometryForCurrentDisplay, transitionWindowGeometry, type WindowBounds } from './window-layout'

const display = { x: -1440, y: 0, width: 1440, height: 900 }

describe('window geometry', () => {
  it('uses saved mode geometry only when it belongs to the current display', () => {
    const savedOnPrimary = { x: 200, y: 100, width: 1200, height: 800 }
    const geometry = { popover: { x: -1000, y: 80, width: 460, height: 640 }, expanded: savedOnPrimary }
    expect(geometryForCurrentDisplay(geometry, 'expanded', false).expanded).toBeUndefined()
    expect(geometryForCurrentDisplay(geometry, 'expanded', true).expanded).toEqual(savedOnPrimary)
  })

  it('clamps a saved window onto a monitor with negative coordinates', () => {
    expect(clampWindowBounds({ x: -3000, y: 700, width: 460, height: 640 }, display, 'popover'))
      .toEqual({ x: -1440, y: 260, width: 560, height: 640 })
  })

  it('fits a window to a display smaller than its minimum', () => {
    expect(clampWindowBounds({ x: 20, y: 20, width: 1200, height: 800 }, { x: 0, y: 0, width: 700, height: 500 }, 'expanded'))
      .toEqual({ x: 0, y: 0, width: 700, height: 500 })
  })

  it('uses the active display work area for full-screen mode', () => {
    expect(centeredBounds('fullscreen', display)).toEqual(display)
  })

  it('starts with the compact ChatGPT Classic sized popover', () => {
    expect(centeredBounds('popover', display)).toEqual({ x: -1170, y: 340, width: 900, height: 220 })
  })

  it('remembers the user-sized expanded window when collapsing and expanding again', () => {
    const userSize: WindowBounds = { x: -1320, y: 40, width: 1000, height: 760 }
    const collapsed = transitionWindowGeometry('expanded', userSize, 'popover', {}, display, centeredBounds('popover', display))
    const expanded = transitionWindowGeometry('popover', collapsed.bounds, 'expanded', collapsed.geometry, display, centeredBounds('expanded', display))
    expect(expanded.bounds).toEqual(userSize)
  })
})
