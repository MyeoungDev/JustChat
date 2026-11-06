import { describe, expect, it } from 'vitest'
import { classifyProviderPopup, isAllowedProviderNavigation, isSecureProviderRedirect, providers, resolveProviderSelection } from './providers'

describe('provider navigation policy', () => {
  it('allows HTTPS provider and configured login hosts', () => {
    expect(isAllowedProviderNavigation('https://chatgpt.com/', providers[0])).toBe(true)
    expect(isAllowedProviderNavigation('https://accounts.google.com/signin', providers[0])).toBe(true)
    expect(isAllowedProviderNavigation('https://login.microsoftonline.com/', providers[0])).toBe(true)
    expect(isAllowedProviderNavigation('https://appleid.apple.com/', providers[0])).toBe(true)
  })

  it('allows secure redirect hops while rejecting insecure or malformed redirects', () => {
    expect(isSecureProviderRedirect('https://unlisted-auth.example/callback')).toBe(true)
    expect(isSecureProviderRedirect('http://unlisted-auth.example/')).toBe(false)
    expect(isSecureProviderRedirect('not a URL')).toBe(false)
  })

  it('rejects unconfigured hosts, insecure URLs, and malformed URLs', () => {
    expect(isAllowedProviderNavigation('https://example.com/', providers[0])).toBe(false)
    expect(isAllowedProviderNavigation('http://chatgpt.com/', providers[0])).toBe(false)
    expect(isAllowedProviderNavigation('not a URL', providers[0])).toBe(false)
  })

  it('assigns a separate persistent browser partition to each provider', () => {
    const partitions = providers.map((provider) => provider.sessionPartition)
    expect(partitions.every((partition) => partition.startsWith('persist:'))).toBe(true)
    expect(new Set(partitions).size).toBe(providers.length)
  })

  it('switches only to wired Providers and treats selecting the active one as a no-op', () => {
    expect(resolveProviderSelection('chatgpt', 'claude')).toEqual({ providerId: 'claude', changed: true })
    expect(resolveProviderSelection('chatgpt', 'chatgpt')).toEqual({ providerId: 'chatgpt', changed: false })
    expect(resolveProviderSelection('chatgpt', 'gemini')).toBeNull()
  })

  it('keeps allowlisted authentication popups in the Provider session', () => {
    expect(classifyProviderPopup('https://auth.openai.com/log-in', providers[0])).toBe('provider')
    expect(classifyProviderPopup('https://accounts.google.com/', providers[0])).toBe('provider')
    expect(classifyProviderPopup('https://example.com/', providers[0])).toBe('external')
    expect(classifyProviderPopup('javascript:alert(1)', providers[0])).toBe('deny')
  })
})
