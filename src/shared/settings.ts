import type { ProviderId } from './providers'
import type { WindowGeometry, WindowGeometryByDisplay } from './window-layout'

export interface ShortcutBindings {
  toggle: string
  temporaryChat: string
  toggleSize: string
  toggleFullscreen: string
  providers: Partial<Record<ProviderId, string>>
}

export type OpacityMode = 'window' | 'background'
export type ThemePreference = 'system' | 'dark' | 'light'

export interface AppSettings {
  activeProviderId: ProviderId
  shortcuts: ShortcutBindings
  alwaysOnTop: boolean
  autoHidePopover: boolean
  escapeHidesPopover: boolean
  opacity: number
  theme: ThemePreference
  opacityMode: OpacityMode
  backgroundOpacity: number
  pageZoomPercent: number
  pageZoomScaleVersion: number
  lastChatGPTConversationPath?: string
  resetAfterMinutes: number
  geometry: WindowGeometry
  geometryByDisplay: WindowGeometryByDisplay
}

export function defaultSettings(platform: string): AppSettings {
  const isMac = platform === 'darwin'
  return {
    activeProviderId: 'chatgpt',
    shortcuts: {
      toggle: isMac ? 'Alt+Space' : 'Control+Shift+Space',
      temporaryChat: isMac ? 'Command+Shift+N' : 'Control+Shift+N',
      toggleSize: isMac ? 'Command+Shift+E' : 'Control+Shift+E',
      toggleFullscreen: isMac ? 'Command+Shift+F' : 'Control+Shift+F',
      providers: isMac
        ? { chatgpt: 'Alt+1', claude: 'Alt+2' }
        : { chatgpt: 'Control+Shift+1', claude: 'Control+Shift+2' }
    },
    alwaysOnTop: true,
    autoHidePopover: false,
    escapeHidesPopover: true,
    opacity: 1,
    theme: 'system',
    opacityMode: 'window',
    backgroundOpacity: 0.9,
    pageZoomPercent: 100,
    pageZoomScaleVersion: 3,
    resetAfterMinutes: 30,
    geometry: {},
    geometryByDisplay: {}
  }
}

export function normalizeSettings(value: unknown, platform: string): AppSettings {
  const defaults = defaultSettings(platform)
  if (!value || typeof value !== 'object') return defaults
  const input = value as Partial<AppSettings>
  let lastChatGPTConversationPath: string | undefined
  if (typeof input.lastChatGPTConversationPath === 'string') {
    try {
      const restoredUrl = new URL(input.lastChatGPTConversationPath, 'https://chatgpt.com/')
      if (restoredUrl.protocol === 'https:' && ['chatgpt.com', 'www.chatgpt.com'].includes(restoredUrl.hostname)
        && /(?:^|\/)c\/[^/]+(?:\/|$)/i.test(restoredUrl.pathname)) {
        lastChatGPTConversationPath = restoredUrl.pathname
      }
    } catch { /* ignore malformed persisted conversation routes */ }
  }
  const geometry: WindowGeometry = {}
  const geometryByDisplay: WindowGeometryByDisplay = {}
  const normalizeBounds = (mode: keyof WindowGeometry, bounds: { x: number; y: number; width: number; height: number }) =>
    mode === 'compact' && bounds.width === 520 && bounds.height === 200
      ? { ...bounds, height: 320 }
      : { ...bounds }
  for (const mode of ['popover', 'compact', 'expanded', 'fullscreen'] as const) {
    const bounds = input.geometry?.[mode]
    if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
      geometry[mode] = mode === 'popover' && bounds.width === 460 && bounds.height === 640
        ? { x: bounds.x - 220, y: bounds.y + 210, width: 900, height: 220 }
        : normalizeBounds(mode, bounds)
    }
  }
  for (const mode of ['popover', 'compact', 'expanded', 'fullscreen'] as const) {
    const saved = input.geometryByDisplay?.[mode]
    if (!saved || typeof saved !== 'object') continue
    const entries = Object.entries(saved).filter(([, bounds]) =>
      bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    ).map(([displayId, bounds]) => [displayId, normalizeBounds(mode, bounds)] as const)
    if (entries.length) geometryByDisplay[mode] = Object.fromEntries(entries)
  }
  return {
    activeProviderId: input.activeProviderId === 'claude' ? 'claude' : 'chatgpt',
    shortcuts: {
      toggle: typeof input.shortcuts?.toggle === 'string' ? input.shortcuts.toggle : defaults.shortcuts.toggle,
      temporaryChat: typeof input.shortcuts?.temporaryChat === 'string' ? input.shortcuts.temporaryChat : defaults.shortcuts.temporaryChat,
      toggleSize: typeof input.shortcuts?.toggleSize === 'string' ? input.shortcuts.toggleSize : defaults.shortcuts.toggleSize,
      toggleFullscreen: typeof input.shortcuts?.toggleFullscreen === 'string' ? input.shortcuts.toggleFullscreen : defaults.shortcuts.toggleFullscreen,
      providers: {
        chatgpt: typeof input.shortcuts?.providers?.chatgpt === 'string' ? input.shortcuts.providers.chatgpt : defaults.shortcuts.providers.chatgpt,
        claude: typeof input.shortcuts?.providers?.claude === 'string' ? input.shortcuts.providers.claude : defaults.shortcuts.providers.claude
      }
    },
    alwaysOnTop: typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : defaults.alwaysOnTop,
    autoHidePopover: typeof input.autoHidePopover === 'boolean' ? input.autoHidePopover : defaults.autoHidePopover,
    escapeHidesPopover: typeof input.escapeHidesPopover === 'boolean' ? input.escapeHidesPopover : defaults.escapeHidesPopover,
    opacity: typeof input.opacity === 'number' && Number.isFinite(input.opacity) ? Math.min(1, Math.max(0.6, input.opacity)) : defaults.opacity,
    theme: input.theme === 'dark' || input.theme === 'light' || input.theme === 'system' ? input.theme : defaults.theme,
    opacityMode: input.opacityMode === 'background' || input.opacityMode === 'window' ? input.opacityMode : defaults.opacityMode,
    backgroundOpacity: typeof input.backgroundOpacity === 'number' && Number.isFinite(input.backgroundOpacity) ? Math.min(1, Math.max(0.7, input.backgroundOpacity)) : defaults.backgroundOpacity,
    pageZoomPercent: typeof input.pageZoomPercent === 'number' && Number.isFinite(input.pageZoomPercent)
      ? Math.min(120, Math.max(70, Math.round(input.pageZoomScaleVersion === 2
        ? input.pageZoomPercent * 83 / 99.6
        : input.pageZoomScaleVersion === 3
          ? input.pageZoomPercent
          : (input.pageZoomPercent === 91 ? 83 : input.pageZoomPercent) * 100 / 99.6)))
      : defaults.pageZoomPercent,
    pageZoomScaleVersion: 3,
    lastChatGPTConversationPath,
    resetAfterMinutes: [0, 15, 30, 60].includes(input.resetAfterMinutes ?? -1) ? input.resetAfterMinutes! : defaults.resetAfterMinutes,
    geometry,
    geometryByDisplay
  }
}

/** 100% preserves the previous maximum scale (83% base × 120% setting). */
export function pageZoomFactor(percent: number): number {
  return 0.996 * percent / 100
}

const modifierNames = new Map([
  ['alt', 'Alt'],
  ['control', 'Control'],
  ['command', 'Command'],
  ['shift', 'Shift'],
  ['super', 'Super']
])
const modifierOrder = ['Alt', 'Control', 'Command', 'Shift', 'Super']
const keyNames = new Map<string, string>([
  ['space', 'Space'], ['enter', 'Enter'], ['tab', 'Tab'], ['escape', 'Escape'], ['backspace', 'Backspace'],
  ['delete', 'Delete'], ['insert', 'Insert'], ['home', 'Home'], ['end', 'End'], ['pageup', 'PageUp'],
  ['pagedown', 'PageDown'], ['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'],
  ['plus', 'Plus'], ['comma', 'Comma'], ['period', 'Period']
])

export function normalizeAccelerator(accelerator: string): string | undefined {
  const parts = accelerator.split('+').map((part) => part.trim())
  if (parts.length < 2 || parts.some((part) => !part)) return undefined
  const modifiers: string[] = []
  const mainKeys: string[] = []
  for (const part of parts) {
    const modifier = modifierNames.get(part.toLowerCase())
    if (modifier) modifiers.push(modifier)
    else mainKeys.push(part)
  }
  if (!modifiers.length || new Set(modifiers).size !== modifiers.length || mainKeys.length !== 1) return undefined

  const rawKey = mainKeys[0]
  const namedKey = keyNames.get(rawKey.toLowerCase())
  const key = namedKey
    ?? (/^[a-z0-9]$/i.test(rawKey) ? rawKey.toUpperCase() : /^f([1-9]|1\d|2[0-4])$/i.test(rawKey) ? rawKey.toUpperCase() : undefined)
  if (!key) return undefined

  modifiers.sort((left, right) => modifierOrder.indexOf(left) - modifierOrder.indexOf(right))
  return [...modifiers, key].join('+')
}

export function isValidAccelerator(accelerator: string): boolean {
  return normalizeAccelerator(accelerator) !== undefined
}

export type ShortcutName = 'toggle' | 'temporary-chat' | 'toggle-size' | 'toggle-fullscreen' | `provider:${ProviderId}`

export function validateShortcutMap(bindings: Partial<Record<ShortcutName, string>>, platform?: string): string[] {
  const errors: string[] = []
  const seen = new Map<string, ShortcutName>()
  for (const [name, accelerator] of Object.entries(bindings) as [ShortcutName, string][]) {
    const normalized = normalizeAccelerator(accelerator)
    if (!normalized) {
      errors.push(`${name}:invalid`)
      continue
    }
    const previous = seen.get(normalized.toLowerCase())
    if (previous) errors.push(`${name}:duplicate:${previous}`)
    else seen.set(normalized.toLowerCase(), name)
    if (platform && isReservedProviderShortcut(normalized, platform)) errors.push(`${name}:reserved:chatgpt-sidebar`)
  }
  return errors
}

export function isReservedProviderShortcut(accelerator: string, platform: string): boolean {
  return platform === 'darwin' && normalizeAccelerator(accelerator) === 'Command+Shift+S'
}

export interface KeyboardChord {
  key: string
  code: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  isAutoRepeat?: boolean
  isComposing?: boolean
}

export function acceleratorFromKeyChord(chord: KeyboardChord, platform: string): string | null {
  const modifiersInOrder: string[] = []
  if (chord.altKey) modifiersInOrder.push('Alt')
  if (chord.ctrlKey) modifiersInOrder.push('Control')
  if (chord.metaKey) modifiersInOrder.push(platform === 'darwin' ? 'Command' : 'Super')
  if (chord.shiftKey) modifiersInOrder.push('Shift')

  let key: string
  if (chord.code === 'Space') key = 'Space'
  else if (/^Digit[0-9]$/.test(chord.code)) key = chord.code.slice(-1)
  else if (/^Key[A-Z]$/.test(chord.code)) key = chord.code.slice(-1)
  else if (/^F([1-9]|1\d|2[0-4])$/.test(chord.key)) key = chord.key
  else if (keyNames.has(chord.key.toLowerCase())) key = keyNames.get(chord.key.toLowerCase())!
  else return null

  if (modifiersInOrder.length === 0) return null
  return [...modifiersInOrder, key].join('+')
}
