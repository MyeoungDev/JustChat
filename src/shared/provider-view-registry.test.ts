import { describe, expect, it } from 'vitest'
import { RetainedViewRegistry } from './provider-view-registry'

describe('Provider WebView lifecycle', () => {
  it('reuses each retained view instead of recreating it when selected again', () => {
    const registry = new RetainedViewRegistry<string, { id: string }>()
    let creations = 0
    const chatgpt = registry.getOrCreate('chatgpt', () => ({ id: `view-${++creations}` }))
    const claude = registry.getOrCreate('claude', () => ({ id: `view-${++creations}` }))
    expect(registry.getOrCreate('chatgpt', () => ({ id: `view-${++creations}` }))).toBe(chatgpt)
    expect(registry.getOrCreate('claude', () => ({ id: `view-${++creations}` }))).toBe(claude)
    expect(creations).toBe(2)
  })
})
