export function isTrustedShellSender(
  senderId: number,
  expectedId: number | undefined,
  isMainFrame: boolean,
  frameUrl: string,
  developmentOrigin?: string,
  expectedFileUrl?: string
): boolean {
  if (expectedId === undefined || senderId !== expectedId || !isMainFrame) return false
  try {
    const parsed = new URL(frameUrl)
    if (developmentOrigin) return parsed.origin === developmentOrigin
    return parsed.protocol === 'file:' && expectedFileUrl !== undefined && parsed.href === expectedFileUrl
  } catch {
    return false
  }
}

export function isSafeExternalUrl(url: string): boolean {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}
