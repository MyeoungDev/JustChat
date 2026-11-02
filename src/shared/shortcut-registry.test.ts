import { describe, expect, it } from 'vitest'
import { registerShortcutBindings, replaceShortcutBindings, type ShortcutApi } from './shortcut-registry'

class FakeShortcutApi implements ShortcutApi {
  readonly active = new Set<string>()
  readonly unavailable = new Set<string>()
  register(accelerator: string) {
    if (this.unavailable.has(accelerator) || this.active.has(accelerator)) return false
    this.active.add(accelerator)
    return true
  }
  unregister(accelerator: string) { this.active.delete(accelerator) }
}

describe('global shortcut registration', () => {
  it('reports registration conflicts without losing successful startup bindings', () => {
    const api = new FakeShortcutApi()
    api.unavailable.add('Alt+2')
    const result = registerShortcutBindings(api, { toggle: 'Alt+Space', 'provider:claude': 'Alt+2' }, { toggle: () => {}, 'provider:claude': () => {} })
    expect(result.failed).toEqual(['provider:claude'])
    expect(result.registered).toEqual({ toggle: 'Alt+Space' })
    expect(api.active.has('Alt+Space')).toBe(true)
  })

  it('restores old bindings when a replacement conflicts', () => {
    const api = new FakeShortcutApi()
    const callbacks = { toggle: () => {}, 'provider:chatgpt': () => {} }
    const current = { toggle: 'Alt+Space', 'provider:chatgpt': 'Alt+1' }
    const old = registerShortcutBindings(api, current, callbacks)
    api.unavailable.add('Control+Shift+Space')
    const result = replaceShortcutBindings(api, old.registered, { toggle: 'Control+Shift+Space', 'provider:chatgpt': 'Control+Shift+1' }, callbacks)
    expect(result.failed).toEqual(['toggle'])
    expect(result.registered).toEqual(current)
    expect(api.active).toEqual(new Set(['Alt+Space', 'Alt+1']))
  })
})
