export type WindowMode = 'popover' | 'compact' | 'expanded' | 'fullscreen'

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
  popover: { width: 900, height: 600 },
  compact: { width: 520, height: 320 },
  expanded: { width: 520, height: 480 },
  fullscreen: { width: 0, height: 0 }
}

export const minimumWindowSizes: Record<WindowMode, { width: number; height: number }> = {
  popover: { width: 700, height: 600 },
  compact: { width: 480, height: 180 },
  expanded: { width: 480, height: 320 },
  fullscreen: { width: 0, height: 0 }
}

export function windowSizeForDisplay(mode: WindowMode, _display: DisplayWorkArea): { width: number; height: number } {
  return windowSizes[mode]
}

export function boundsAnchoredAtBottom(current: WindowBounds, target: WindowBounds, display: DisplayWorkArea): WindowBounds {
  const width = Math.min(target.width, display.width)
  const height = Math.min(target.height, display.height)
  return clampWindowBounds({
    x: Math.round(current.x + (current.width - width) / 2),
    y: current.y + current.height - height,
    width,
    height
  }, display, 'expanded')
}

export type WindowGeometry = Partial<Record<WindowMode, WindowBounds>>
export type WindowGeometryByDisplay = Partial<Record<WindowMode, Record<string, WindowBounds>>>

export function modeForProviderPage(currentMode: WindowMode): WindowMode {
  return currentMode === 'popover' ? 'compact' : currentMode
}

export function geometryForCurrentDisplay(
  geometry: WindowGeometry,
  targetMode: WindowMode,
  savedBoundsOnCurrentDisplay: boolean
): WindowGeometry {
  return savedBoundsOnCurrentDisplay ? geometry : { ...geometry, [targetMode]: undefined }
}

export function clampWindowBounds(bounds: WindowBounds, display: DisplayWorkArea, mode: WindowMode = 'popover'): WindowBounds {
  const minimum = minimumWindowSizes[mode]
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
  const size = windowSizeForDisplay(mode, display)
  return clampWindowBounds({
    x: Math.round(display.x + (display.width - size.width) / 2),
    y: Math.round(display.y + (display.height - size.height) / 2),
    ...size
  }, display, mode)
}

export function lowerCenteredBounds(
  mode: WindowMode,
  display: DisplayWorkArea,
  savedBounds?: WindowBounds
): WindowBounds {
  if (mode === 'fullscreen') return { ...display }
  const defaultSize = windowSizeForDisplay(mode, display)
  const size = savedBounds
    ? { width: savedBounds.width, height: savedBounds.height }
    : defaultSize
  const width = Math.min(size.width, display.width)
  const height = Math.min(size.height, display.height)
  return clampWindowBounds({
    x: Math.round(display.x + (display.width - width) / 2),
    y: Math.round(display.y + display.height * 0.82 - height / 2),
    width,
    height
  }, display, mode)
}

export function boundsForDisplay(
  mode: WindowMode,
  savedBounds: WindowBounds | undefined,
  display: DisplayWorkArea
): WindowBounds {
  if (mode === 'fullscreen') return { ...display }
  const candidate = savedBounds ?? centeredBounds(mode, display)
  return clampWindowBounds(candidate, display, mode)
}

export function rememberDisplayBounds(
  geometry: WindowGeometryByDisplay,
  mode: WindowMode,
  displayId: string,
  bounds: WindowBounds
): WindowGeometryByDisplay {
  return {
    ...geometry,
    [mode]: { ...geometry[mode], [displayId]: bounds }
  }
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
  const storedTarget = geometry[nextMode]
  const target = storedTarget ?? fallback
  const bounds = clampWindowBounds(target, display, nextMode)
  return { mode: nextMode, geometry: { ...geometry, [nextMode]: bounds }, bounds }
}
