type WebsiteDataType = 'backgroundFetch' | 'cache' | 'cookies' | 'fileSystems' | 'indexedDB' | 'localStorage' | 'serviceWorkers' | 'webSQL'

export type ProviderSessionData = {
  closeAllConnections(): Promise<void>
  clearData(options: { dataTypes: WebsiteDataType[] }): Promise<void>
  clearAuthCache(): Promise<void>
}

const websiteDataTypes: WebsiteDataType[] = [
  'backgroundFetch',
  'cache',
  'cookies',
  'fileSystems',
  'indexedDB',
  'localStorage',
  'serviceWorkers',
  'webSQL'
]

export async function clearProviderSessionData(session: ProviderSessionData): Promise<void> {
  await session.closeAllConnections()
  await session.clearData({ dataTypes: websiteDataTypes })
  await session.clearAuthCache()
}
