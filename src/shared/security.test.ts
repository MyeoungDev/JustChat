import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl, isTrustedShellSender } from './security'

describe('remote and shell boundaries', () => {
  it('accepts IPC only from the registered shell main frame and its local origin', () => {
    expect(isTrustedShellSender(7, 7, true, 'http://localhost:5173/', 'http://localhost:5173')).toBe(true)
    expect(isTrustedShellSender(8, 7, true, 'http://localhost:5173/', 'http://localhost:5173')).toBe(false)
    expect(isTrustedShellSender(7, 7, false, 'http://localhost:5173/', 'http://localhost:5173')).toBe(false)
    expect(isTrustedShellSender(7, 7, true, 'https://chatgpt.com/', 'http://localhost:5173')).toBe(false)
    expect(isTrustedShellSender(7, 7, true, 'file:///app/index.html', undefined, 'file:///app/index.html')).toBe(true)
    expect(isTrustedShellSender(7, 7, true, 'file:///other.html', undefined, 'file:///app/index.html')).toBe(false)
  })

  it('only permits HTTPS links to be opened in the system browser', () => {
    expect(isSafeExternalUrl('https://example.com/path')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
  })
})
