import { describe, expect, it, vi } from 'vitest'
import { clearProviderSessionData, type ProviderSessionData } from './provider-session'

function createSession() {
  const calls: string[] = []
  let clearOptions: { dataTypes: string[] } | undefined
  const clearData = vi.fn<ProviderSessionData['clearData']>(async (options) => {
    calls.push('clear-data')
    clearOptions = options
  })
  const session: ProviderSessionData = {
    closeAllConnections: vi.fn(async () => { calls.push('close-connections') }),
    clearData,
    clearAuthCache: vi.fn(async () => { calls.push('clear-auth-cache') })
  }
  return { session, calls, clearData, get clearOptions() { return clearOptions } }
}

describe('provider session data clearing', () => {
  it('closes connections and clears website data plus auth cache without deleting downloads', async () => {
    const fake = createSession()

    await clearProviderSessionData(fake.session)

    expect(fake.calls).toEqual(['close-connections', 'clear-data', 'clear-auth-cache'])
    expect(fake.clearOptions?.dataTypes).toContain('cookies')
    expect(fake.clearOptions?.dataTypes).toContain('indexedDB')
    expect(fake.clearOptions?.dataTypes).toContain('localStorage')
    expect(fake.clearOptions?.dataTypes).toContain('serviceWorkers')
    expect(fake.clearOptions?.dataTypes).not.toContain('downloads')
  })

  it('does not report a completed clear when a step fails', async () => {
    const fake = createSession()
    fake.clearData.mockRejectedValueOnce(new Error('storage unavailable'))

    await expect(clearProviderSessionData(fake.session)).rejects.toThrow('storage unavailable')
    expect(fake.session.clearAuthCache).not.toHaveBeenCalled()
  })
})
