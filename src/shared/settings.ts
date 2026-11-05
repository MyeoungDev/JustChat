import type { ProviderId } from './providers'
import type { WindowGeometry, WindowGeometryByDisplay } from './window-layout'

export interface ShortcutBindings {
  toggle: string
  chatHistory: string
  providers: Partial<Record<ProviderId, string>>
}

export interface AppSettings {
  activeProviderId: ProviderId
  shortcuts: ShortcutBindings
  alwaysOnTop: boolean
  autoHidePopover: boolean
  escapeHidesPopover: boolean
  opacity: number
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
      chatHistory: isMac ? 'Command+K' : 'Control+K',
      providers: isMac
        ? { chatgpt: 'Alt+1', claude: 'Alt+2' }
        : { chatgpt: 'Control+Shift+1', claude: 'Control+Shift+2' }
    },
    alwaysOnTop: true,
    autoHidePopover: false,
    escapeHidesPopover: true,
    opacity: 1,
    resetAfterMinutes: 30,
    geometry: {},
    geometryByDisplay: {}
  }
}

export function normalizeSettings(value: unknown, platform: string): AppSettings {
  const defaults = defaultSettings(platform)
  if (!value || typeof value !== 'object') return defaults
  const input = value as Partial<AppSettings>
  const geometry: WindowGeometry = {}
  const geometryByDisplay: WindowGeometryByDisplay = {}
  for (const mode of ['popover', 'compact', 'expanded', 'fullscreen'] as const) {
    const bounds = input.geometry?.[mode]
    if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
      geometry[mode] = mode === 'popover' && bounds.width === 460 && bounds.height === 640
        ? { x: bounds.x - 220, y: bounds.y + 210, width: 900, height: 220 }
        : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
  }
  for (const mode of ['popover', 'compact', 'expanded', 'fullscreen'] as const) {
    const saved = input.geometryByDisplay?.[mode]
    if (!saved || typeof saved !== 'object') continue
    const entries = Object.entries(saved).filter(([, bounds]) =>
      bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    )
    if (entries.length) geometryByDisplay[mode] = Object.fromEntries(entries)
  }
  return {
    activeProviderId: input.activeProviderId === 'claude' ? 'claude' : 'chatgpt',
    shortcuts: {
      toggle: typeof input.shortcuts?.toggle === 'string' ? input.shortcuts.toggle : defaults.shortcuts.toggle,
      chatHistory: typeof input.shortcuts?.chatHistory === 'string' ? input.shortcuts.chatHistory : defaults.shortcuts.chatHistory,
      providers: {
        chatgpt: typeof input.shortcuts?.providers?.chatgpt === 'string' ? input.shortcuts.providers.chatgpt : defaults.shortcuts.providers.chatgpt,
        claude: typeof input.shortcuts?.providers?.claude === 'string' ? input.shortcuts.providers.claude : defaults.shortcuts.providers.claude
      }
    },
    alwaysOnTop: typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : defaults.alwaysOnTop,
    autoHidePopover: typeof input.autoHidePopover === 'boolean' ? input.autoHidePopover : defaults.autoHidePopover,
    escapeHidesPopover: typeof input.escapeHidesPopover === 'boolean' ? input.escapeHidesPopover : defaults.escapeHidesPopover,
    opacity: typeof input.opacity === 'number' && Number.isFinite(input.opacity) ? Math.min(1, Math.max(0.6, input.opacity)) : defaults.opacity,
    resetAfterMinutes: [0, 15, 30, 60].includes(input.resetAfterMinutes ?? -1) ? input.resetAfterMinutes! : defaults.resetAfterMinutes,
    geometry,
    geometryByDisplay
  }
}

const modifiers = new Set(['Alt', 'Control', 'Command', 'Shift', 'Super'])
const keys = new Set(['Space', 'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right', 'Plus', 'Comma', 'Period'])

export function isValidAccelerator(accelerator: string): boolean {
  const parts = accelerator.split('+')
  if (parts.length < 2 || parts.some((part) => !part)) return false
  const normalized = parts.map((part) => part.trim())
  const mods = normalized.filter((part) => modifiers.has(part))
  if (mods.length === 0 || new Set(mods).size !== mods.length) return false
  const mainKeys = normalized.filter((part) => !modifiers.has(part))
  if (mainKeys.length !== 1) return false
  const key = mainKeys[0]
  return keys.has(key) || /^[A-Z0-9]$/i.test(key) || /^F([1-9]|1\d|2[0-4])$/.test(key)
}

export type ShortcutName = 'toggle' | 'chat-history' | `provider:${ProviderId}`

export function validateShortcutMap(bindings: Partial<Record<ShortcutName, string>>): string[] {
  const errors: string[] = []
  const seen = new Map<string, ShortcutName>()
  for (const [name, accelerator] of Object.entries(bindings) as [ShortcutName, string][]) {
    if (!isValidAccelerator(accelerator)) {
      errors.push(`${name}:invalid`)
      continue
    }
    const previous = seen.get(accelerator.toLowerCase())
    if (previous) errors.push(`${name}:duplicate:${previous}`)
    else seen.set(accelerator.toLowerCase(), name)
  }
  return errors
}

export interface KeyboardChord {
  key: string
  code: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
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
  else if (keys.has(chord.key)) key = chord.key
  else return null

  if (modifiersInOrder.length === 0) return null
  return [...modifiersInOrder, key].join('+')
}
