export type ProviderId = 'chatgpt' | 'claude'

export interface ProviderAdapter {
  id: ProviderId
  name: string
  url: string
  sessionPartition: string
  allowedTopLevelHosts: readonly string[]
  compatibility: 'experimental'
}

export const providers: readonly ProviderAdapter[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    sessionPartition: 'persist:provider-chatgpt',
    allowedTopLevelHosts: ['chatgpt.com', 'openai.com', 'auth0.com', 'accounts.google.com', 'challenges.cloudflare.com'],
    compatibility: 'experimental'
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/',
    sessionPartition: 'persist:provider-claude',
    allowedTopLevelHosts: ['claude.ai', 'anthropic.com', 'accounts.google.com'],
    compatibility: 'experimental'
  }
]

export const providerChoices = [
  { id: 'chatgpt', name: 'ChatGPT', status: 'experimental', supported: true },
  { id: 'claude', name: 'Claude', status: 'experimental', supported: true },
  { id: 'gemini', name: 'Gemini', status: 'not available in alpha', supported: false },
  { id: 'grok', name: 'Grok', status: 'not available in alpha', supported: false }
] as const

export function isAllowedProviderNavigation(url: string, adapter: ProviderAdapter): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return adapter.allowedTopLevelHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export function classifyProviderPopup(url: string, adapter: ProviderAdapter): 'provider' | 'external' | 'deny' {
  if (isAllowedProviderNavigation(url, adapter)) return 'provider'
  try { return new URL(url).protocol === 'https:' ? 'external' : 'deny' } catch { return 'deny' }
}

export function resolveProviderSelection(current: ProviderId, requested: string): { providerId: ProviderId; changed: boolean } | null {
  if (!providers.some((provider) => provider.id === requested)) return null
  const providerId = requested as ProviderId
  return { providerId, changed: providerId !== current }
}
