export type WindowMode = 'popover' | 'expanded' | 'fullscreen'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayWorkArea {
  x: number
  y: number
  width: number
  height: number
}

export const windowSizes: Record<WindowMode, { width: number; height: number }> = {
  popover: { width: 900, height: 220 },
  expanded: { width: 1200, height: 800 },
  fullscreen: { width: 0, height: 0 }
}

const minimumSizes: Record<WindowMode, { width: number; height: number }> = {
  popover: { width: 560, height: 160 },
  expanded: { width: 800, height: 600 },
  fullscreen: { width: 0, height: 0 }
}

export type WindowGeometry = Partial<Record<WindowMode, WindowBounds>>

export function geometryForCurrentDisplay(
  geometry: WindowGeometry,
  targetMode: WindowMode,
  savedBoundsOnCurrentDisplay: boolean
): WindowGeometry {
  return savedBoundsOnCurrentDisplay ? geometry : { ...geometry, [targetMode]: undefined }
}

export function clampWindowBounds(bounds: WindowBounds, display: DisplayWorkArea, mode: WindowMode = 'popover'): WindowBounds {
  const minimum = minimumSizes[mode]
  const width = Math.min(Math.max(Math.round(bounds.width), Math.min(minimum.width, display.width)), display.width)
  const height = Math.min(Math.max(Math.round(bounds.height), Math.min(minimum.height, display.height)), display.height)
  return {
    x: Math.min(Math.max(Math.round(bounds.x), display.x), display.x + display.width - width),
    y: Math.min(Math.max(Math.round(bounds.y), display.y), display.y + display.height - height),
    width,
    height
  }
}

export function centeredBounds(mode: WindowMode, display: DisplayWorkArea): WindowBounds {
  if (mode === 'fullscreen') return { ...display }
  const size = windowSizes[mode]
  return clampWindowBounds({
    x: Math.round(display.x + (display.width - size.width) / 2),
    y: Math.round(display.y + (display.height - size.height) / 2),
    ...size
  }, display, mode)
}

export function transitionWindowGeometry(
  currentMode: WindowMode,
  currentBounds: WindowBounds,
  nextMode: WindowMode,
  savedGeometry: WindowGeometry,
  display: DisplayWorkArea,
  fallback: WindowBounds
): { mode: WindowMode; geometry: WindowGeometry; bounds: WindowBounds } {
  const geometry = { ...savedGeometry, [currentMode]: clampWindowBounds(currentBounds, display, currentMode) }
  const target = geometry[nextMode] ?? fallback
  const bounds = clampWindowBounds(target, display, nextMode)
  return { mode: nextMode, geometry: { ...geometry, [nextMode]: bounds }, bounds }
}
