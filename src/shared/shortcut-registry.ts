import { validateShortcutMap, type ShortcutName } from './settings'

export type ShortcutBindingsByName = Partial<Record<ShortcutName, string>>
export interface ShortcutApi {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

export interface ShortcutCallbacks {
  [name: string]: (() => void) | undefined
}

export interface RegistrationResult {
  registered: ShortcutBindingsByName
  failed: string[]
}

export function registerShortcutBindings(
  api: ShortcutApi,
  bindings: ShortcutBindingsByName,
  callbacks: ShortcutCallbacks
): RegistrationResult {
  const present = Object.fromEntries(Object.entries(bindings).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) as Partial<Record<ShortcutName, string>>
  const validationErrors = validateShortcutMap(present)
  if (validationErrors.length) return { registered: {}, failed: validationErrors }

  const registered: ShortcutBindingsByName = {}
  const failed: string[] = []
  for (const [name, accelerator] of Object.entries(present) as [ShortcutName, string][]) {
    try {
      if (callbacks[name] && api.register(accelerator, callbacks[name]!)) registered[name] = accelerator
      else failed.push(name)
    } catch {
      failed.push(name)
    }
  }
  return { registered, failed }
}

export function replaceShortcutBindings(
  api: ShortcutApi,
  current: ShortcutBindingsByName,
  next: ShortcutBindingsByName,
  callbacks: ShortcutCallbacks
): RegistrationResult {
  for (const accelerator of Object.values(current)) if (accelerator) api.unregister(accelerator)
  const attempt = registerShortcutBindings(api, next, callbacks)
  if (!attempt.failed.length) return attempt

  for (const accelerator of Object.values(attempt.registered)) if (accelerator) api.unregister(accelerator)
  const rollback = registerShortcutBindings(api, current, callbacks)
  return { registered: rollback.registered, failed: attempt.failed }
}
