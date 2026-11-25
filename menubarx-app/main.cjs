const { app, BrowserWindow, WebContentsView, Tray, Menu, nativeImage, screen, globalShortcut, ipcMain, shell, session, clipboard, dialog, systemPreferences } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

app.setName('Just Browse')
if (process.platform === 'win32') app.setAppUserModelId('com.justchat.justbrowse')

const PANEL_WIDTH = 660
const PANEL_HEIGHT = 570
const TOOLBAR_HEIGHT = 82
const SEARCH_ENGINES = [
  { id: 'google', label: 'Google', queryUrl: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', label: 'DuckDuckGo', queryUrl: 'https://duckduckgo.com/?q=' },
  { id: 'bing', label: 'Bing', queryUrl: 'https://www.bing.com/search?q=' }
]
const SESSION_PARTITION = 'persist:menubarx-profile'
const REFRESH_INTERVALS = [0, 15, 30, 60, 300]
const SHORTCUT_DEFINITIONS = [
  { id: 'togglePanel', label: 'Show or hide Just Browse', description: 'Global shortcut; works while another app is focused.', default: 'Alt+X', global: true },
  { id: 'newTab', label: 'New tab', default: 'CommandOrControl+N' },
  { id: 'closeTab', label: 'Close tab', default: 'CommandOrControl+W' },
  { id: 'hideWindow', label: 'Hide browser window', default: 'CommandOrControl+Shift+W' },
  { id: 'focusAddress', label: 'Focus address bar', default: 'CommandOrControl+L' },
  { id: 'startPage', label: 'Open start page', default: 'CommandOrControl+Shift+H' },
  { id: 'reload', label: 'Reload page', default: 'CommandOrControl+R' },
  { id: 'forceReload', label: 'Force reload without cache', default: 'CommandOrControl+Shift+R' },
  { id: 'nextTab', label: 'Select next tab', default: 'CommandOrControl+Shift+Right' },
  { id: 'previousTab', label: 'Select previous tab', default: 'CommandOrControl+Shift+Left' },
  ...Array.from({ length: 9 }, (_, index) => ({ id: `selectTab${index + 1}`, label: `Select tab ${index + 1}`, default: `CommandOrControl+${index + 1}` })),
  { id: 'back', label: 'Go back', default: 'CommandOrControl+[' },
  { id: 'forward', label: 'Go forward', default: 'CommandOrControl+]' },
  { id: 'zoomIn', label: 'Zoom in', default: 'CommandOrControl+Plus' },
  { id: 'zoomOut', label: 'Zoom out', default: 'CommandOrControl+-' },
  { id: 'zoomReset', label: 'Reset zoom', default: 'CommandOrControl+0' },
  { id: 'togglePin', label: 'Pin or unpin window', default: 'CommandOrControl+Shift+P' },
  { id: 'detachTab', label: 'Detach or reattach tab', default: 'CommandOrControl+Shift+D' },
  { id: 'openExternal', label: 'Open page in default browser', default: 'CommandOrControl+Shift+O' },
  { id: 'settings', label: 'Open settings', default: 'CommandOrControl+Comma' },
  { id: 'downloads', label: 'Open downloads', default: 'CommandOrControl+Shift+J' }
]
const DEFAULT_SHORTCUTS = Object.fromEntries(SHORTCUT_DEFINITIONS.map(({ id, default: accelerator }) => [id, accelerator]))
const USER_AGENT_PROFILES = [
  { id: 'default', label: 'Default (Chromium)' },
  { id: 'chrome', label: 'Desktop (Chrome)' },
  { id: 'mac-safari', label: 'Desktop (macOS Safari)' },
  { id: 'ios-safari', label: 'Mobile (iOS Safari)' },
  { id: 'android-chrome', label: 'Mobile (Android Chrome)' },
  { id: 'custom', label: 'Custom User-Agent' }
]
const SITE_PERMISSIONS = new Set(['notifications', 'geolocation', 'camera', 'microphone'])
const PERMISSION_LABELS = { notifications: 'notifications', geolocation: 'your location', camera: 'your camera', microphone: 'your microphone' }
const VIEWPORT_PROFILES = [
  { id: 'desktop', label: 'Desktop', width: 0, height: 0, scale: 1 },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, scale: 2 },
  { id: 'iphone-16', label: 'iPhone 16', width: 393, height: 852, scale: 3 },
  { id: 'ipad', label: 'iPad', width: 820, height: 1180, scale: 2 },
  { id: 'pixel-9', label: 'Pixel 9', width: 412, height: 915, scale: 2 }
]
const MAX_TAB_CHOICES = [5, 10, 15, 20, 30]
const TAB_DISCARD_CHOICES = [0, 5, 10, 30]
const DEFAULT_SETTINGS = {
  searchEngine: 'google', homepage: '', userAgentProfile: 'default', userAgentCustom: '',
  defaultRefreshSeconds: 0, defaultZoomLevel: 0, downloadDirectory: '',
  shortcuts: DEFAULT_SHORTCUTS, panelShortcut: 'Alt+X', restoreTabs: true, closeOnBlur: true, presentation: 'panel',
  defaultViewportProfile: 'desktop', maxTabs: 15, discardIdleMinutes: 10
}
let tray
let window
let browserSession
let activeView
let mainPage = 'browser'
let settingsWindow
let presentationRebuildPending = false
const views = new Map()
const detachedWindows = new Map()
const websiteAppWindows = new Set()
const idleDiscardTimers = new Map()
let pinned = false
let store
let tabs = []
let activeTabId = ''
let bookmarkItems = []
let sitePermissions = {}
let downloadRecords = []
const liveDownloads = new Map()
const resumeQueue = new Map()
let downloadsWindow
const pendingPermissionPrompts = new Map()
let searchEngine = 'google'
let settings = { ...DEFAULT_SETTINGS }
let panelShortcut = DEFAULT_SETTINGS.panelShortcut
let persistTimer
const refreshTimers = new Map()

function loadStore() {
  migrateLegacyUserData()
  const file = path.join(app.getPath('userData'), 'browser-data.json')
  let saved = {}
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch { /* create an empty first-run profile */ }
  const savedSettings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {}
  const shortcuts = Object.fromEntries(SHORTCUT_DEFINITIONS.map((definition) => {
    const legacyValue = definition.id === 'togglePanel' ? savedSettings.panelShortcut : undefined
    const savedValue = savedSettings.shortcuts?.[definition.id] ?? legacyValue ?? definition.default
    return [definition.id, savedValue === '' && definition.id !== 'togglePanel' ? '' : normalizeAccelerator(savedValue) || definition.default]
  }))
  settings = {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    shortcuts,
    searchEngine: SEARCH_ENGINES.some((engine) => engine.id === savedSettings.searchEngine) ? savedSettings.searchEngine : DEFAULT_SETTINGS.searchEngine,
    homepage: normalizeStoredUrl(savedSettings.homepage),
    userAgentProfile: USER_AGENT_PROFILES.some((profile) => profile.id === savedSettings.userAgentProfile) ? savedSettings.userAgentProfile : DEFAULT_SETTINGS.userAgentProfile,
    userAgentCustom: typeof savedSettings.userAgentCustom === 'string' ? savedSettings.userAgentCustom.slice(0, 512) : '',
    defaultRefreshSeconds: REFRESH_INTERVALS.includes(savedSettings.defaultRefreshSeconds) ? savedSettings.defaultRefreshSeconds : 0,
    defaultZoomLevel: [-2, -1, 0, 1, 2].includes(savedSettings.defaultZoomLevel) ? savedSettings.defaultZoomLevel : 0,
    panelShortcut: shortcuts.togglePanel,
    restoreTabs: typeof savedSettings.restoreTabs === 'boolean' ? savedSettings.restoreTabs : true,
    closeOnBlur: typeof savedSettings.closeOnBlur === 'boolean' ? savedSettings.closeOnBlur : true,
    presentation: savedSettings.presentation === 'window' ? 'window' : 'panel',
    defaultViewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === savedSettings.defaultViewportProfile) ? savedSettings.defaultViewportProfile : 'desktop',
    maxTabs: MAX_TAB_CHOICES.includes(savedSettings.maxTabs) ? savedSettings.maxTabs : DEFAULT_SETTINGS.maxTabs,
    discardIdleMinutes: TAB_DISCARD_CHOICES.includes(savedSettings.discardIdleMinutes) ? savedSettings.discardIdleMinutes : DEFAULT_SETTINGS.discardIdleMinutes,
    downloadDirectory: isDirectory(savedSettings.downloadDirectory) ? savedSettings.downloadDirectory : app.getPath('downloads')
  }
  searchEngine = settings.searchEngine
  panelShortcut = settings.shortcuts.togglePanel
  tabs = Array.isArray(saved.tabs) && savedSettings.restoreTabs !== false ? saved.tabs : []
  bookmarkItems = Array.isArray(saved.bookmarks) ? saved.bookmarks : []
  downloadRecords = Array.isArray(saved.downloads) ? saved.downloads.filter((item) => item && typeof item.id === 'string').slice(0, 50).map((item) => ({ ...item, state: item.state === 'progressing' ? 'interrupted' : item.state, paused: false })) : []
  activeTabId = typeof saved.activeTabId === 'string' ? saved.activeTabId : ''
  sitePermissions = {}
  if (saved.permissions && typeof saved.permissions === 'object' && !Array.isArray(saved.permissions)) {
    for (const [origin, values] of Object.entries(saved.permissions)) {
      const normalizedOrigin = safePermissionOrigin(origin)
      if (!normalizedOrigin || !Array.isArray(values)) continue
      const validPermissions = [...new Set(values.filter((permission) => SITE_PERMISSIONS.has(permission)))]
      if (validPermissions.length) sitePermissions[normalizedOrigin] = validPermissions
    }
  }
  if (!tabs.length) tabs = [newTabRecord()]
  tabs = tabs.filter((tab) => tab && typeof tab.id === 'string').slice(0, settings.maxTabs).map((tab) => ({
    id: tab.id,
    url: normalizeStoredUrl(tab.url),
    title: typeof tab.title === 'string' ? tab.title.slice(0, 300) : safeHost(tab.url || ''),
    refreshSeconds: REFRESH_INTERVALS.includes(tab.refreshSeconds) ? tab.refreshSeconds : settings.defaultRefreshSeconds,
    zoomLevel: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].includes(tab.zoomLevel) ? tab.zoomLevel : settings.defaultZoomLevel,
    userAgentProfile: USER_AGENT_PROFILES.some((profile) => profile.id === tab.userAgentProfile) ? tab.userAgentProfile : settings.userAgentProfile,
    userAgentCustom: typeof tab.userAgentCustom === 'string' ? tab.userAgentCustom.slice(0, 512) : '',
    viewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === tab.viewportProfile) ? tab.viewportProfile : settings.defaultViewportProfile,
    discarded: false
  }))
  if (!tabs.length) tabs = [newTabRecord()]
  bookmarkItems = bookmarkItems.filter((item) => item && typeof item.url === 'string' && normalizeStoredUrl(item.url)).map((item) => ({ title: String(item.title || safeHost(item.url)).slice(0, 80), url: normalizeStoredUrl(item.url), icon: String(item.icon || item.title || safeHost(item.url)).replace(/[\r\n\0]/g, '').slice(0, 8) }))
  if (!tabs.some((tab) => tab.id === activeTabId)) activeTabId = tabs[0].id
  store = file
}

function migrateLegacyUserData() {
  const destination = app.getPath('userData')
  const legacy = path.join(app.getPath('appData'), 'Menu Browser')
  if (path.resolve(destination) === path.resolve(legacy) || !fs.existsSync(legacy)) return
  const copyMissing = (source, target) => {
    const sourceStat = fs.lstatSync(source)
    if (sourceStat.isSymbolicLink()) return
    if (!sourceStat.isDirectory()) {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL)
      }
      return
    }
    fs.mkdirSync(target, { recursive: true })
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue
      const sourceEntry = path.join(source, entry.name)
      const targetEntry = path.join(target, entry.name)
      if (!fs.existsSync(targetEntry)) copyMissing(sourceEntry, targetEntry)
      else if (entry.isDirectory() && fs.statSync(targetEntry).isDirectory()) copyMissing(sourceEntry, targetEntry)
    }
  }
  try {
    if (!fs.existsSync(destination)) fs.renameSync(legacy, destination)
    else copyMissing(legacy, destination)
  } catch (error) {
    console.warn('Could not fully migrate the previous browser profile:', error.message)
  }
}

function newTabRecord(url = settings.homepage) {
  return { id: crypto.randomUUID(), url, title: url ? safeHost(url) : 'New Tab', refreshSeconds: settings.defaultRefreshSeconds, zoomLevel: settings.defaultZoomLevel, userAgentProfile: settings.userAgentProfile, userAgentCustom: '', viewportProfile: settings.defaultViewportProfile, discarded: false }
}

function normalizeStoredUrl(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))) return parsed.href
  } catch { /* ignore invalid persisted addresses */ }
  return ''
}

function isDirectory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) return false
  try { return fs.statSync(value).isDirectory() } catch { return false }
}

function safeHost(url) {
  try { return new URL(url).hostname } catch { return 'New Tab' }
}

function normalizeAccelerator(value) {
  if (typeof value !== 'string') return null
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const keyAliases = { comma: 'Comma', period: 'Period', slash: '/', minus: '-', plus: 'Plus', space: 'Space', escape: 'Escape', esc: 'Escape', left: 'Left', right: 'Right', up: 'Up', down: 'Down', enter: 'Enter', return: 'Enter' }
  const modifiers = new Map([['commandorcontrol', 'CommandOrControl'], ['cmdorctrl', 'CommandOrControl'], ['command', 'Command'], ['cmd', 'Command'], ['control', 'Control'], ['ctrl', 'Control'], ['alt', 'Alt'], ['option', 'Alt'], ['shift', 'Shift'], ['super', 'Super'], ['meta', 'Super']])
  const key = keyAliases[parts.at(-1).toLowerCase()] || parts.at(-1)
  const validKey = /^[A-Z0-9]$/i.test(key) || /^F([1-9]|1[0-9]|2[0-4])$/i.test(key) || ['Comma', 'Period', '/', '-', 'Plus', 'Space', 'Escape', 'Left', 'Right', 'Up', 'Down', 'Enter', '[', ']', '~', '`', '=', ';', "'", '\\'].includes(key)
  if (!validKey) return null
  const normalizedModifiers = []
  for (const part of parts.slice(0, -1)) {
    const modifier = modifiers.get(part.toLowerCase())
    if (!modifier || normalizedModifiers.includes(modifier)) return null
    normalizedModifiers.push(modifier)
  }
  if (!normalizedModifiers.length || (normalizedModifiers.includes('CommandOrControl') && normalizedModifiers.some((modifier) => ['Command', 'Control', 'Super'].includes(modifier)))) return null
  const order = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Shift', 'Super']
  return [...order.filter((modifier) => normalizedModifiers.includes(modifier)), key.length === 1 ? key.toUpperCase() : key]
    .join('+')
}

function shortcutMatches(input, accelerator) {
  const normalized = normalizeAccelerator(accelerator)
  if (!normalized) return false
  const parts = normalized.split('+')
  const key = parts.pop()
  const modifiers = new Set(parts)
  const command = modifiers.has('Command') || (modifiers.has('CommandOrControl') && process.platform === 'darwin')
  const control = modifiers.has('Control') || (modifiers.has('CommandOrControl') && process.platform !== 'darwin')
  const alt = modifiers.has('Alt')
  const superKey = modifiers.has('Super')
  const shift = modifiers.has('Shift') || key === 'Plus'
  if (Boolean(input.meta) !== (command || superKey) || Boolean(input.control) !== control || Boolean(input.alt) !== alt || Boolean(input.shift) !== shift) return false
  const keyAliases = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', ' ': 'Space', Escape: 'Escape', Enter: 'Enter', ',': 'Comma', '.': 'Period', '+': 'Plus' }
  const eventKey = keyAliases[input.key] || (input.key?.length === 1 ? input.key.toUpperCase() : input.key)
  return eventKey === key || (key === 'Plus' && input.code === 'Equal' && input.shift)
}

function installKeyboardShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return
    if (mainPage === 'settings') return
    if (input.key === 'Escape' && contents === window?.webContents && settings.presentation === 'panel' && mainPage === 'browser') {
      event.preventDefault(); window?.hide(); return
    }
    const definition = SHORTCUT_DEFINITIONS.find((item) => shortcutMatches(input, settings.shortcuts[item.id]))
    if (!definition) return
    if (mainPage === 'settings' && !['togglePanel', 'hideWindow', 'settings'].includes(definition.id)) return
    event.preventDefault()
    const associatedTab = [...views.entries()].find(([, view]) => view.webContents.id === contents.id)?.[0]
      || [...detachedWindows.entries()].find(([, child]) => !child.isDestroyed() && child.webContents.id === contents.id)?.[0]
      || activeTabId
    runShortcut(definition.id, associatedTab)
  })
}

function runShortcut(id, tabId = activeTabId) {
  const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
  switch (id) {
    case 'togglePanel': showPanel(); break
    case 'newTab': createNewTab(); break
    case 'closeTab': if (tabs.length > 1) closeTab(tabId); else window?.hide(); break
    case 'hideWindow': window?.hide(); break
    case 'focusAddress':
      if (!window || window.isDestroyed()) createPanel()
      if (!window.isVisible()) showPanel()
      activeView?.webContents.blur()
      window.webContents.focus()
      void window.webContents.executeJavaScript("document.querySelector('#address')?.focus(); document.querySelector('#address')?.select()")
      break
    case 'startPage': goHome(); break
    case 'reload': if (tabId === activeTabId) activeView?.webContents.reload(); else views.get(tabId)?.webContents.reload(); break
    case 'forceReload': if (tabId === activeTabId) activeView?.webContents.reloadIgnoringCache(); else views.get(tabId)?.webContents.reloadIgnoringCache(); break
    case 'nextTab': if (tabs.length > 1) activateTab(tabs[(Math.max(0, tabIndex) + 1) % tabs.length].id); break
    case 'previousTab': if (tabs.length > 1) activateTab(tabs[(Math.max(0, tabIndex) - 1 + tabs.length) % tabs.length].id); break
    case 'back': { const view = views.get(tabId); if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack(); break }
    case 'forward': { const view = views.get(tabId); if (view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward(); break }
    case 'zoomIn': if (tabId === activeTabId) adjustZoom(0.5); break
    case 'zoomOut': if (tabId === activeTabId) adjustZoom(-0.5); break
    case 'zoomReset': if (tabId === activeTabId) resetZoom(); break
    case 'togglePin': pinned = !pinned; window?.setAlwaysOnTop(pinned, 'screen-saver'); sendState(); break
    case 'detachTab': toggleTabDetachment(tabId); break
    case 'openExternal': { const tab = tabs.find((item) => item.id === tabId); if (tab?.url) void shell.openExternal(tab.url); break }
    case 'settings': if (mainPage === 'settings') closeSettingsPage(); else showSettingsPage(); break
    case 'downloads': showDownloadsWindow(); break
    default: {
      const match = id.match(/^selectTab([1-9])$/)
      if (match && tabs[Number(match[1]) - 1]) activateTab(tabs[Number(match[1]) - 1].id)
    }
  }
}

function saveSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify({ tabs, activeTabId, bookmarks: bookmarkItems, permissions: sitePermissions, settings, downloads: downloadRecords.slice(0, 50) }, null, 2), { mode: 0o600 }) } catch (error) { console.error('Could not save browser data:', error.message) }
  }, 250)
}

function flushStore() {
  clearTimeout(persistTimer)
  if (!store) return
  try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify({ tabs, activeTabId, bookmarks: bookmarkItems, permissions: sitePermissions, settings, downloads: downloadRecords.slice(0, 50) }, null, 2), { mode: 0o600 }) }
  catch (error) { console.error('Could not save browser data:', error.message) }
}

function publishDownloads() {
  const state = downloadRecords.map((record) => ({ ...record, live: liveDownloads.has(record.id), canPause: liveDownloads.has(record.id) && !record.paused && record.state === 'progressing', canResume: (liveDownloads.has(record.id) && record.paused) || record.state === 'interrupted' }))
  if (downloadsWindow && !downloadsWindow.isDestroyed()) downloadsWindow.webContents.send('downloads:state', state)
  return state
}

function showDownloadsWindow() {
  if (downloadsWindow && !downloadsWindow.isDestroyed()) { downloadsWindow.show(); downloadsWindow.focus(); publishDownloads(); return }
  downloadsWindow = new BrowserWindow({ width: 760, height: 620, minWidth: 560, minHeight: 420, show: false, title: 'Downloads', webPreferences: { preload: path.join(__dirname, 'downloads-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  downloadsWindow.setMenuBarVisibility(false)
  void downloadsWindow.loadFile(path.join(__dirname, 'downloads.html'))
  downloadsWindow.once('ready-to-show', () => { if (!downloadsWindow.isDestroyed()) { downloadsWindow.show(); publishDownloads() } })
  downloadsWindow.on('closed', () => { downloadsWindow = undefined })
}

function downloadSnapshot(item, record) {
  record.state = item.getState()
  record.paused = item.isPaused()
  record.receivedBytes = item.getReceivedBytes()
  record.totalBytes = item.getTotalBytes()
  record.percent = record.totalBytes > 0 ? Math.max(0, Math.min(100, Math.floor(record.receivedBytes / record.totalBytes * 100))) : 0
  record.speed = item.getCurrentBytesPerSecond()
  record.filename = item.getFilename()
  record.path = item.getSavePath()
  record.urlChain = item.getURLChain()
  record.mimeType = item.getMimeType()
  record.lastModified = item.getLastModifiedTime()
  record.eTag = item.getETag()
  record.startTime = item.getStartTime()
  record.updatedAt = Date.now()
  saveSoon(); publishDownloads()
}

function attachDownload(item, record) {
  liveDownloads.set(record.id, item)
  item.on('updated', () => downloadSnapshot(item, record))
  item.once('done', (_event, state) => {
    record.state = state
    record.paused = false
    if (state === 'completed') { record.percent = 100; record.path = item.getSavePath() }
    liveDownloads.delete(record.id)
    downloadSnapshot(item, record)
    if (window && !window.isDestroyed()) window.webContents.send('app:download-status', state === 'completed' ? `Download saved: ${record.filename}` : `Download ${state}: ${record.filename}`)
  })
  downloadSnapshot(item, record)
}

function safePermissionOrigin(value) {
  try {
    const url = new URL(String(value || ''))
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname))) return ''
    return url.origin
  } catch { return '' }
}

function permissionEntries() {
  return Object.entries(sitePermissions).flatMap(([origin, permissions]) => permissions.map((permission) => ({ origin, permission, label: PERMISSION_LABELS[permission] || permission })))
}

function permissionKinds(permission, details = {}) {
  if (permission !== 'media') return SITE_PERMISSIONS.has(permission) ? [permission] : []
  const types = Array.isArray(details.mediaTypes) ? details.mediaTypes : details.mediaType === 'video' ? ['video'] : details.mediaType === 'audio' ? ['audio'] : []
  return [...new Set(types.map((type) => type === 'video' ? 'camera' : type === 'audio' ? 'microphone' : '').filter((type) => SITE_PERMISSIONS.has(type)))]
}

function configureSitePermissions(browserSession) {
  browserSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details = {}) => {
    const permissions = permissionKinds(permission, details)
    const origin = safePermissionOrigin(requestingOrigin)
    if (!origin || (contents && (contents.isDestroyed() || origin !== safePermissionOrigin(contents.getURL())))) return false
    if (!permissions.length && permission === 'media') return ['camera', 'microphone'].some((item) => sitePermissions[origin]?.includes(item))
    if (!permissions.length) return false
    return permissions.every((item) => sitePermissions[origin]?.includes(item))
  })
  browserSession.setPermissionRequestHandler((contents, permission, callback, details = {}) => {
    const permissions = permissionKinds(permission, details)
    if (!permissions.length || (contents && contents.isDestroyed())) { callback(false); return }
    const origin = safePermissionOrigin(details.requestingUrl || contents?.getURL())
    const topOrigin = contents ? safePermissionOrigin(contents.getURL()) : origin
    if (!origin || origin !== topOrigin) { callback(false); return }
    if (permissions.every((item) => sitePermissions[origin]?.includes(item))) { callback(true); return }

    const key = `${origin}|${permissions.join(',')}`
    let prompt = pendingPermissionPrompts.get(key)
    if (!prompt) {
      const hostname = new URL(origin).hostname
      const parent = window && !window.isDestroyed() && window.isVisible() ? window : undefined
      prompt = dialog.showMessageBox(parent, {
        type: 'question',
        buttons: ['Allow this site', 'Block'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: 'Website permission',
        message: `${hostname} wants to access ${permissions.map((item) => PERMISSION_LABELS[item]).join(' and ')}.`,
        detail: 'You can review or revoke site permissions in Settings.'
      }).then(({ response }) => response === 0)
      pendingPermissionPrompts.set(key, prompt)
      void prompt.then(() => pendingPermissionPrompts.delete(key), () => pendingPermissionPrompts.delete(key))
    }
    void prompt.then(async (allowed) => {
      if (!allowed) { callback(false); return }
      if (process.platform === 'darwin') {
        for (const item of permissions.filter((value) => value === 'camera' || value === 'microphone')) {
          if (!await systemPreferences.askForMediaAccess(item)) { callback(false); return }
        }
      }
      const current = sitePermissions[origin] || []
      sitePermissions[origin] = [...new Set([...current, ...permissions])]
      saveSoon()
      if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('settings:permissions-changed', permissionEntries())
      else if (mainPage === 'settings' && window && !window.isDestroyed()) window.webContents.send('settings:permissions-changed', permissionEntries())
      if (!contents || !contents.isDestroyed()) callback(true)
    }).catch(() => { if (!contents || !contents.isDestroyed()) callback(false) })
  })
}

function activeTab() { return tabs.find((tab) => tab.id === activeTabId) || tabs[0] }

function sendState() {
  if (!window || window.isDestroyed()) return
  const state = {
    tabs: tabs.map(({ id, url, title, refreshSeconds, userAgentProfile, viewportProfile, discarded }) => ({ id, url, title, refreshSeconds, userAgentProfile, viewportProfile, discarded, detached: detachedWindows.has(id) })),
    bookmarks: bookmarkItems,
    searchEngine,
    activeTabId,
    pinned,
    muted: Boolean(activeView && !activeView.webContents.isDestroyed() && activeView.webContents.isAudioMuted()),
    canGoBack: Boolean(activeView && activeView.webContents.navigationHistory.canGoBack()),
    canGoForward: Boolean(activeView && activeView.webContents.navigationHistory.canGoForward())
  }
  window.webContents.send('app:state-changed', state)
}

function normalizedUrl(input) {
  const value = String(input || '').trim()
  if (!value) return ''
  let candidate = value
  if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    const queryUrl = SEARCH_ENGINES.find((engine) => engine.id === searchEngine)?.queryUrl || SEARCH_ENGINES[0].queryUrl
    candidate = candidate.includes('.') && !/\s/.test(candidate) ? `https://${candidate}` : `${queryUrl}${encodeURIComponent(candidate)}`
  }
  let url
  try { url = new URL(candidate) } catch { throw new Error('Enter a valid website address or search term.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS addresses are supported.')
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Use HTTPS for public websites.')
  return url.href
}

function updateBounds() {
  if (!window || !activeView) return
  const [width, height] = window.getContentSize()
  activeView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) })
  applyViewportProfile(activeView, activeTab(), width, Math.max(0, height - TOOLBAR_HEIGHT))
}

function applyViewportProfile(view, record, availableWidth = PANEL_WIDTH, availableHeight = PANEL_HEIGHT - TOOLBAR_HEIGHT) {
  if (!view || view.webContents.isDestroyed()) return
  const profile = VIEWPORT_PROFILES.find((item) => item.id === record?.viewportProfile) || VIEWPORT_PROFILES[0]
  if (!profile.width) { view.webContents.disableDeviceEmulation(); return }
  const scale = Math.min(1, availableWidth / profile.width, availableHeight / profile.height)
  view.webContents.enableDeviceEmulation({
    screenPosition: 'mobile', screenSize: { width: profile.width, height: profile.height },
    viewPosition: { x: 0, y: 0 }, viewSize: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.scale, scale
  })
}

function setTabViewport(id, profileId) {
  const record = tabs.find((tab) => tab.id === id)
  const view = views.get(id)
  if (!record || !view || !VIEWPORT_PROFILES.some((profile) => profile.id === profileId)) return
  record.viewportProfile = profileId
  applyViewportProfile(view, record)
  saveSoon(); sendState()
}

function scheduleTabDiscard(id) {
  clearTimeout(idleDiscardTimers.get(id))
  idleDiscardTimers.delete(id)
  if (!settings.discardIdleMinutes) return
  const timer = setTimeout(() => {
    idleDiscardTimers.delete(id)
    const view = views.get(id)
    const record = tabs.find((tab) => tab.id === id)
    if (!view || !record || activeTabId === id || detachedWindows.has(id) || !record.url || view.webContents.isDestroyed() || view.webContents.isCurrentlyAudible()) return
    disposeView(view)
    views.delete(id)
    record.discarded = true
    clearInterval(refreshTimers.get(id)); refreshTimers.delete(id)
    saveSoon(); sendState()
  }, settings.discardIdleMinutes * 60_000)
  idleDiscardTimers.set(id, timer)
}

function createNewTab(url = settings.homepage) {
  if (tabs.length >= settings.maxTabs) {
    if (window && !window.isDestroyed()) window.webContents.send('app:download-status', `You have reached the ${settings.maxTabs}-tab limit.`)
    return { error: `You have reached the ${settings.maxTabs}-tab limit.` }
  }
  const record = newTabRecord(url)
  tabs.push(record)
  activateTab(record.id)
  return record.id
}

function disposeView(view) {
  if (!view || view.webContents.isDestroyed()) return
  try { view.webContents.close() } catch { /* already closing */ }
}

function userAgentFor(profile, custom = '') {
  if (profile === 'custom') return String(custom || settings.userAgentCustom).replace(/[\r\n\0]/g, '').trim().slice(0, 512) || app.userAgentFallback
  if (profile === 'chrome') return app.userAgentFallback.replace(/\sElectron\/[^ ]+/g, '')
  if (profile === 'mac-safari') return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
  if (profile === 'ios-safari') return 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  if (profile === 'android-chrome') return `Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Mobile Safari/537.36`
  return app.userAgentFallback
}

function applyUserAgent(contents, record) {
  contents.setUserAgent(userAgentFor(record.userAgentProfile, record.userAgentCustom))
}

function setTabUserAgent(id, profile) {
  if (!USER_AGENT_PROFILES.some((option) => option.id === profile)) return
  const record = tabs.find((tab) => tab.id === id)
  const view = views.get(id)
  if (!record || !view || view.webContents.isDestroyed()) return
  record.userAgentProfile = profile
  record.userAgentCustom = ''
  applyUserAgent(view.webContents, record)
  if (record.url) view.webContents.reload()
  saveSoon(); sendState()
}

function makeView(record) {
  const view = new WebContentsView({
    webPreferences: {
      partition: SESSION_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })
  view.setBackgroundColor('#ffffff')
  const contents = view.webContents
  installKeyboardShortcuts(contents)
  contents.setZoomLevel(Number.isFinite(record.zoomLevel) ? record.zoomLevel : settings.defaultZoomLevel)
  applyUserAgent(contents, record)
  contents.setWindowOpenHandler(({ url }) => {
    try { const parsed = new URL(url); if (parsed.protocol === 'https:') void shell.openExternal(url) } catch { /* reject malformed popup */ }
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url)
      if (!['https:', 'http:'].includes(parsed.protocol) || (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))) event.preventDefault()
    } catch { event.preventDefault() }
  })
  contents.on('did-navigate', (_event, url) => {
    record.url = url
    record.title = contents.getTitle() || safeHost(url)
    saveSoon(); sendState()
  })
  contents.on('did-navigate-in-page', (_event, url) => { record.url = url; saveSoon(); sendState() })
  contents.on('page-title-updated', (_event, title) => { record.title = title || safeHost(record.url); saveSoon(); sendState() })
  contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) {
      console.warn(`Page load failed (${code}): ${description}`)
      if (window && !window.isDestroyed() && record.id === activeTabId) window.webContents.send('app:navigate-error', description)
    }
  })
  contents.on('context-menu', (_event, params) => {
    const safeLink = normalizeStoredUrl(params.linkURL)
    const safeMedia = normalizeStoredUrl(params.srcURL)
    const template = [
      { label: 'Back', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Forward', enabled: contents.navigationHistory.canGoForward(), click: () => contents.navigationHistory.goForward() },
      { label: 'Reload', click: () => contents.reload() }
    ]
    if (params.selectionText) template.push({ type: 'separator' }, { label: 'Copy Selection', role: 'copy' })
    if (safeLink) template.push({ type: 'separator' }, { label: 'Copy Link', click: () => clipboard.writeText(safeLink) }, { label: 'Open Link in Default Browser', click: () => { void shell.openExternal(safeLink) } }, { label: 'Save Link As…', click: () => contents.downloadURL(safeLink) })
    if (safeMedia && params.mediaType !== 'none') template.push({ type: 'separator' }, { label: params.mediaType === 'image' ? 'Save Image As…' : 'Save Media As…', click: () => contents.downloadURL(safeMedia) }, { label: 'Open Media in Default Browser', click: () => { void shell.openExternal(safeMedia) } })
    Menu.buildFromTemplate(template).popup({ window })
  })
  if (record.url) void contents.loadURL(record.url).catch(() => undefined)
  return view
}

function activateTab(id) {
  const target = tabs.find((tab) => tab.id === id)
  if (!target) return
  const detachedWindow = detachedWindows.get(id)
  if (detachedWindow && !detachedWindow.isDestroyed()) { detachedWindow.show(); detachedWindow.focus(); return }
  const previousId = activeTabId
  if (activeView) window.contentView.removeChildView(activeView)
  if (previousId !== id) scheduleTabDiscard(previousId)
  clearTimeout(idleDiscardTimers.get(id)); idleDiscardTimers.delete(id)
  activeTabId = id
  activeView = views.get(id)
  if (!activeView) {
    activeView = makeView(target)
    views.set(id, activeView)
  }
  target.discarded = false
  window.contentView.addChildView(activeView)
  syncAutoRefresh(target)
  activeView.setVisible(Boolean(target.url))
  updateBounds()
  saveSoon(); sendState()
}

function reattachTab(id, focus = true) {
  const detachedWindow = detachedWindows.get(id)
  const view = views.get(id)
  if (!detachedWindow || !view) return
  if (!window || window.isDestroyed()) createPanel()
  detachedWindows.delete(id)
  detachedWindow._menuBrowserClosing = true
  try { detachedWindow.contentView.removeChildView(view) } catch { /* view was already removed */ }
  detachedWindow.close()
  activateTab(id)
  if (focus) { window.show(); window.focus() }
}

function detachActiveTab() {
  const record = activeTab()
  const view = activeView
  if (!record || !view || detachedWindows.has(record.id)) return
  window.contentView.removeChildView(view)
  activeView = undefined

  const detachedWindow = new BrowserWindow({
    width: PANEL_WIDTH, height: PANEL_HEIGHT, minWidth: 420, minHeight: 320,
    show: false, title: record.title || safeHost(record.url), backgroundColor: '#fff',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  installKeyboardShortcuts(detachedWindow.webContents)
  detachedWindow.contentView.addChildView(view)
  const updateDetachedBounds = () => {
    if (detachedWindow.isDestroyed() || view.webContents.isDestroyed()) return
    const [width, height] = detachedWindow.getContentSize()
    view.setBounds({ x: 0, y: 0, width, height })
  }
  detachedWindow.on('resize', updateDetachedBounds)
  detachedWindow.on('close', (event) => {
    if (!detachedWindow._menuBrowserClosing) { event.preventDefault(); reattachTab(record.id) }
  })
  view.webContents.on('page-title-updated', (_event, title) => {
    if (!detachedWindow.isDestroyed()) detachedWindow.setTitle(title || record.title || safeHost(record.url))
  })
  detachedWindows.set(record.id, detachedWindow)
  updateDetachedBounds()
  detachedWindow.show()
  detachedWindow.focus()

  let replacement = tabs.find((tab) => tab.id !== record.id && !detachedWindows.has(tab.id))
  if (!replacement && tabs.length < settings.maxTabs) { replacement = newTabRecord(); tabs.push(replacement) }
  if (replacement) activateTab(replacement.id)
  else { reattachTab(record.id, true); window?.webContents.send('app:download-status', 'Tab limit reached. Close a tab before detaching this one.') }
}

function toggleTabDetachment(id) {
  if (detachedWindows.has(id)) { reattachTab(id); return }
  activateTab(id)
  detachActiveTab()
}

function navigate(input) {
  let url
  try { url = normalizedUrl(input) } catch (error) { return { error: error.message } }
  if (!url) return { error: 'Enter a website address or search term.' }
  const record = activeTab()
  record.url = url
  record.title = safeHost(url)
  if (activeView && !activeView.webContents.isDestroyed()) {
    activeView.setVisible(true)
    void activeView.webContents.loadURL(url).catch((error) => {
      if (window && !window.isDestroyed()) window.webContents.send('app:navigate-error', error.message)
    })
  }
  saveSoon(); sendState()
  return { ok: true }
}

function goHome() {
  const record = activeTab()
  record.url = ''
  record.title = 'New Tab'
  if (activeView && !activeView.webContents.isDestroyed()) {
    activeView.webContents.stop()
    activeView.setVisible(false)
  }
  saveSoon(); sendState()
}

function syncAutoRefresh(record) {
  clearInterval(refreshTimers.get(record.id))
  refreshTimers.delete(record.id)
  if (!record.refreshSeconds || !REFRESH_INTERVALS.includes(record.refreshSeconds)) return
  const timer = setInterval(() => {
    const view = views.get(record.id)
    if (record.url && view && !view.webContents.isDestroyed() && !view.webContents.isLoading()) view.webContents.reload()
  }, record.refreshSeconds * 1000)
  refreshTimers.set(record.id, timer)
}

function setRefreshInterval(id, seconds) {
  const record = tabs.find((tab) => tab.id === id)
  if (!record || !REFRESH_INTERVALS.includes(seconds)) return
  record.refreshSeconds = seconds
  syncAutoRefresh(record)
  saveSoon(); sendState()
}

function adjustZoom(delta) {
  if (!activeView || activeView.webContents.isDestroyed()) return
  const level = Math.max(-5, Math.min(5, activeView.webContents.getZoomLevel() + delta))
  activeView.webContents.setZoomLevel(level)
  activeTab().zoomLevel = level
  saveSoon()
}

function resetZoom() {
  if (activeView && !activeView.webContents.isDestroyed()) { activeView.webContents.setZoomLevel(0); activeTab().zoomLevel = 0; saveSoon() }
}

function toggleMute() {
  if (!activeView || activeView.webContents.isDestroyed()) return
  activeView.webContents.setAudioMuted(!activeView.webContents.isAudioMuted())
  sendState()
}

function showBrowserMenu() {
  const tab = activeTab()
  const template = [
    { label: 'New Tab', accelerator: settings.shortcuts.newTab || undefined, click: () => createNewTab() },
    { label: 'Close Tab', accelerator: settings.shortcuts.closeTab || undefined, enabled: tabs.length > 1, click: () => closeTab(activeTabId) },
    { label: 'Next Tab', accelerator: settings.shortcuts.nextTab || undefined, click: () => runShortcut('nextTab') },
    { label: 'Previous Tab', accelerator: settings.shortcuts.previousTab || undefined, click: () => runShortcut('previousTab') },
    ...tabs.slice(0, 9).map((item, index) => ({ label: `Tab ${index + 1}`, accelerator: settings.shortcuts[`selectTab${index + 1}`] || undefined, click: () => activateTab(item.id) })),
    { type: 'separator' },
    { label: 'Start Page', accelerator: settings.shortcuts.startPage || undefined, click: goHome },
    { label: 'Reload', accelerator: settings.shortcuts.reload || undefined, click: () => activeView?.webContents.reload() },
    { label: 'Force Refresh', accelerator: settings.shortcuts.forceReload || undefined, click: () => activeView?.webContents.reloadIgnoringCache() },
    { label: 'Open in Default Browser', accelerator: settings.shortcuts.openExternal || undefined, enabled: Boolean(tab.url), click: () => { if (tab.url) void shell.openExternal(tab.url) } },
    { label: 'Open as Website App Window', enabled: Boolean(tab.url), click: () => { if (tab.url) openWebsiteApp(tab.url, tab.title) } },
    { label: 'Clear Site Data…', enabled: Boolean(safePermissionOrigin(tab.url)), click: () => { void clearCurrentSiteData() } },
    { label: 'Detach Tab to Window', accelerator: settings.shortcuts.detachTab || undefined, click: () => toggleTabDetachment(tab.id) },
    { label: 'User-Agent', submenu: USER_AGENT_PROFILES.map((profile) => ({ label: profile.label, type: 'radio', checked: (tab.userAgentProfile || settings.userAgentProfile) === profile.id, click: () => setTabUserAgent(tab.id, profile.id) })) },
    { label: 'Device Viewport', submenu: VIEWPORT_PROFILES.map((profile) => ({ label: profile.label, type: 'radio', checked: (tab.viewportProfile || 'desktop') === profile.id, click: () => setTabViewport(tab.id, profile.id) })) },
    { label: 'Search Engine', submenu: SEARCH_ENGINES.map((engine) => ({ label: engine.label, type: 'radio', checked: searchEngine === engine.id, click: () => { searchEngine = engine.id; settings.searchEngine = engine.id; saveSoon() } })) },
    { label: 'Auto Refresh', submenu: REFRESH_INTERVALS.map((seconds) => ({ label: seconds ? `${seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds === 60 ? '' : 's'}`}` : 'Off', type: 'radio', checked: (tab.refreshSeconds || 0) === seconds, click: () => setRefreshInterval(tab.id, seconds) })) },
    { label: 'Zoom', submenu: [
      { label: 'Zoom In', accelerator: settings.shortcuts.zoomIn || undefined, click: () => adjustZoom(0.5) },
      { label: 'Zoom Out', accelerator: settings.shortcuts.zoomOut || undefined, click: () => adjustZoom(-0.5) },
      { label: 'Reset Zoom', accelerator: settings.shortcuts.zoomReset || undefined, click: resetZoom }
    ] },
    { type: 'separator' },
    { label: 'Mute Website Audio', type: 'checkbox', checked: Boolean(activeView?.webContents.isAudioMuted()), click: toggleMute },
    { label: 'Keep on Top', type: 'checkbox', checked: pinned, click: () => { pinned = !pinned; window.setAlwaysOnTop(pinned, 'screen-saver'); sendState() } },
    { type: 'separator' },
    { label: 'Settings…', accelerator: settings.shortcuts.settings || undefined, click: showSettingsPage },
    { label: 'Downloads…', accelerator: settings.shortcuts.downloads || undefined, click: showDownloadsWindow },
    { label: 'Hide Window', accelerator: settings.shortcuts.hideWindow || undefined, click: () => window?.hide() },
    { label: 'Quit Just Browse', role: 'quit' }
  ]
  Menu.buildFromTemplate(template).popup({ window })
}

function showSettingsPage() {
  if (!window || window.isDestroyed()) createPanel()
  if (!window.isVisible()) {
    if (settings.presentation === 'panel') showPanel()
    else { window.show(); window.focus() }
  }
  if (settings.presentation === 'window') {
    if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return }
    settingsWindow = new BrowserWindow({
      width: 620, height: 700, minWidth: 560, minHeight: 580, show: false,
      title: 'Just Browse Settings', backgroundColor: '#f5f5f5', parent: window, modal: true,
      webPreferences: { preload: path.join(__dirname, 'settings-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    settingsWindow.setMenuBarVisibility(false)
    void settingsWindow.loadFile(path.join(__dirname, 'settings.html'))
    settingsWindow.once('ready-to-show', () => { if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus() } })
    settingsWindow.on('closed', () => {
      settingsWindow = undefined
      if (presentationRebuildPending) { presentationRebuildPending = false; rebuildMainWindow() }
      if (window && !window.isDestroyed()) { window.show(); window.focus() }
    })
    return
  }
  if (mainPage === 'settings') { window.show(); window.focus(); return }
  mainPage = 'settings'
  if (activeView && !activeView.webContents.isDestroyed()) {
    activeView.setVisible(false)
    try { window.contentView.removeChildView(activeView) } catch { /* view was already detached */ }
  }
  void window.loadFile(path.join(__dirname, 'settings.html')).then(() => { if (window && !window.isDestroyed()) window.focus() })
}

function closeSettingsPage() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.close(); return }
  if (!window || window.isDestroyed() || mainPage !== 'settings') return
  const wasVisible = window.isVisible()
  mainPage = 'browser'
  if (presentationRebuildPending) {
    presentationRebuildPending = false
    rebuildMainWindow()
    if (wasVisible && window && !window.isDestroyed()) { window.show(); window.focus() }
    return
  }
  void window.loadFile(path.join(__dirname, 'index.html')).then(() => {
    if (!window || window.isDestroyed()) return
    window.setTitle('Just Browse')
    if (activeView && !activeView.webContents.isDestroyed()) {
      window.contentView.addChildView(activeView)
      activeView.setVisible(Boolean(activeTab()?.url))
      updateBounds()
      sendState()
    } else {
      activeView = undefined
      activateTab(activeTabId)
    }
    if (wasVisible) window.show()
    window.focus()
  })
}

function openWebsiteApp(rawUrl, displayTitle = '') {
  let url
  try { url = normalizedUrl(rawUrl) } catch { return }
  if (!url) return
  const parsed = new URL(url)
  const appWindow = new BrowserWindow({
    width: 980, height: 720, minWidth: 520, minHeight: 420, show: false,
    title: String(displayTitle || parsed.hostname).slice(0, 100), icon: makeTrayIcon(),
    autoHideMenuBar: true,
    webPreferences: { partition: SESSION_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
  })
  installKeyboardShortcuts(appWindow.webContents)
  websiteAppWindows.add(appWindow)
  appWindow.setMenuBarVisibility(false)
  appWindow.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    const safe = normalizeStoredUrl(popupUrl)
    if (safe) void shell.openExternal(safe)
    return { action: 'deny' }
  })
  appWindow.webContents.on('will-navigate', (event, nextUrl) => {
    if (!normalizeStoredUrl(nextUrl)) { event.preventDefault(); return }
    try { appWindow.setTitle(new URL(nextUrl).hostname) } catch { /* keep current title */ }
  })
  appWindow.once('ready-to-show', () => { if (!appWindow.isDestroyed()) { appWindow.show(); appWindow.focus() } })
  appWindow.on('closed', () => websiteAppWindows.delete(appWindow))
  void appWindow.loadURL(url).catch((error) => console.warn('Website app failed to load:', error.message))
  return appWindow
}

function registerPanelShortcut(shortcut) {
  if (panelShortcut) globalShortcut.unregister(panelShortcut)
  if (globalShortcut.register(shortcut, showPanel)) { panelShortcut = shortcut; return true }
  if (panelShortcut) globalShortcut.register(panelShortcut, showPanel)
  return false
}

function publicSettings() {
  return { ...settings, shortcuts: { ...settings.shortcuts }, shortcutDefinitions: SHORTCUT_DEFINITIONS, downloadDirectory: settings.downloadDirectory || app.getPath('downloads'), sitePermissions: permissionEntries() }
}

function revokeSitePermission(originInput, permissionInput) {
  const origin = safePermissionOrigin(originInput)
  if (!origin || !SITE_PERMISSIONS.has(permissionInput) || !sitePermissions[origin]?.includes(permissionInput)) return false
  sitePermissions[origin] = sitePermissions[origin].filter((permission) => permission !== permissionInput)
  if (!sitePermissions[origin].length) delete sitePermissions[origin]
  saveSoon()
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('settings:permissions-changed', permissionEntries())
  else if (mainPage === 'settings' && window && !window.isDestroyed()) window.webContents.send('settings:permissions-changed', permissionEntries())
  return true
}

async function clearCurrentSiteData() {
  const tab = activeTab()
  const origin = safePermissionOrigin(tab?.url)
  if (!origin || !activeView || activeView.webContents.isDestroyed()) return
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning', buttons: ['Clear Site Data', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
    title: 'Clear Website Data', message: `Clear stored data for ${new URL(origin).hostname}?`,
    detail: 'This removes cookies, local storage, databases, and service worker data for this site. You may be signed out.'
  })
  if (response !== 0) return
  try {
    await browserSession.clearStorageData({ origin, storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'serviceworkers', 'cachestorage'] })
    for (const permission of [...(sitePermissions[origin] || [])]) revokeSitePermission(origin, permission)
    activeView.webContents.reload()
    window?.webContents.send('app:download-status', `Website data cleared for ${new URL(origin).hostname}.`)
  } catch (error) {
    window?.webContents.send('app:download-status', `Could not clear website data: ${error.message}`)
  }
}

function saveSettings(input = {}) {
  const homepageInput = String(input.homepage || '').trim()
  const homepage = homepageInput ? normalizeStoredUrl(homepageInput) : ''
  if (homepageInput && !homepage) return { error: 'Use a valid HTTPS homepage address.' }
  const shortcutInput = input.shortcuts && typeof input.shortcuts === 'object' ? input.shortcuts : settings.shortcuts
  const shortcuts = {}
  for (const definition of SHORTCUT_DEFINITIONS) {
    const raw = Object.prototype.hasOwnProperty.call(shortcutInput, definition.id) ? String(shortcutInput[definition.id] || '').trim() : settings.shortcuts[definition.id]
    const normalized = raw ? normalizeAccelerator(raw) : ''
    if ((!normalized && raw) || (!normalized && definition.id === 'togglePanel')) return { error: `Choose a valid shortcut for “${definition.label}”.` }
    shortcuts[definition.id] = normalized
  }
  const assigned = new Map()
  for (const definition of SHORTCUT_DEFINITIONS) {
    const accelerator = shortcuts[definition.id]
    if (!accelerator) continue
    const previous = assigned.get(accelerator)
    if (previous) return { error: `“${definition.label}” conflicts with “${previous.label}”.` }
    assigned.set(accelerator, definition)
  }
  const next = {
    ...settings,
    shortcuts,
    searchEngine: SEARCH_ENGINES.some((engine) => engine.id === input.searchEngine) ? input.searchEngine : settings.searchEngine,
    homepage,
    userAgentProfile: USER_AGENT_PROFILES.some((profile) => profile.id === input.userAgentProfile) ? input.userAgentProfile : settings.userAgentProfile,
    userAgentCustom: String(input.userAgentCustom || '').replace(/[\r\n\0]/g, '').trim().slice(0, 512),
    defaultRefreshSeconds: REFRESH_INTERVALS.includes(Number(input.defaultRefreshSeconds)) ? Number(input.defaultRefreshSeconds) : settings.defaultRefreshSeconds,
    defaultZoomLevel: [-2, -1, 0, 1, 2].includes(Number(input.defaultZoomLevel)) ? Number(input.defaultZoomLevel) : settings.defaultZoomLevel,
    defaultViewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === input.defaultViewportProfile) ? input.defaultViewportProfile : settings.defaultViewportProfile,
    maxTabs: MAX_TAB_CHOICES.includes(Number(input.maxTabs)) ? Number(input.maxTabs) : settings.maxTabs,
    discardIdleMinutes: TAB_DISCARD_CHOICES.includes(Number(input.discardIdleMinutes)) ? Number(input.discardIdleMinutes) : settings.discardIdleMinutes,
    downloadDirectory: isDirectory(input.downloadDirectory) ? input.downloadDirectory : settings.downloadDirectory,
    restoreTabs: typeof input.restoreTabs === 'boolean' ? input.restoreTabs : settings.restoreTabs,
    closeOnBlur: typeof input.closeOnBlur === 'boolean' ? input.closeOnBlur : settings.closeOnBlur,
    presentation: input.presentation === 'window' ? 'window' : input.presentation === 'panel' ? 'panel' : settings.presentation,
    panelShortcut: shortcuts.togglePanel
  }
  const maxTabs = MAX_TAB_CHOICES.includes(Number(input.maxTabs)) ? Number(input.maxTabs) : settings.maxTabs
  if (maxTabs < tabs.length) return { error: `Close tabs until ${tabs.length} or fewer are open before lowering the tab limit.` }
  if (shortcuts.togglePanel !== panelShortcut && !registerPanelShortcut(shortcuts.togglePanel)) return { error: 'The global shortcut is already being used by macOS or another app.' }
  const presentationChanged = settings.presentation !== next.presentation
  const discardPolicyChanged = settings.discardIdleMinutes !== next.discardIdleMinutes
  settings = next
  searchEngine = settings.searchEngine
  for (const tab of tabs) {
    if (tab.userAgentProfile !== 'custom') continue
    tab.userAgentCustom = ''
    const view = views.get(tab.id)
    if (view && !view.webContents.isDestroyed()) { applyUserAgent(view.webContents, tab); if (tab.url) view.webContents.reload() }
  }
  if (presentationChanged) {
    if (mainPage === 'settings' || (settingsWindow && !settingsWindow.isDestroyed())) presentationRebuildPending = true
    else rebuildMainWindow()
  }
  if (discardPolicyChanged) {
    for (const timer of idleDiscardTimers.values()) clearTimeout(timer)
    idleDiscardTimers.clear()
    for (const tab of tabs) if (tab.id !== activeTabId && !detachedWindows.has(tab.id)) scheduleTabDiscard(tab.id)
  }
  saveSoon(); sendState()
  return { settings: publicSettings() }
}

function resetSettings() {
  const defaults = { ...DEFAULT_SETTINGS, shortcuts: { ...DEFAULT_SHORTCUTS }, downloadDirectory: app.getPath('downloads') }
  return saveSettings(defaults)
}

function closeTab(id) {
  if (!window || tabs.length < 2) return
  const index = tabs.findIndex((tab) => tab.id === id)
  if (index < 0) return
  const closingActive = id === activeTabId
  const closingView = views.get(id)
  const detachedWindow = detachedWindows.get(id)
  if (detachedWindow && !detachedWindow.isDestroyed()) {
    detachedWindows.delete(id)
    detachedWindow._menuBrowserClosing = true
    try { detachedWindow.contentView.removeChildView(closingView) } catch { /* view was already removed */ }
    detachedWindow.close()
  }
  if (closingActive && activeView) { window.contentView.removeChildView(activeView); activeView = undefined }
  disposeView(closingView); views.delete(id); tabs.splice(index, 1)
  clearInterval(refreshTimers.get(id)); refreshTimers.delete(id)
  clearTimeout(idleDiscardTimers.get(id)); idleDiscardTimers.delete(id)
  if (closingActive) activateTab(tabs[Math.max(0, index - 1)].id)
  else { saveSoon(); sendState() }
}

function makeTrayIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="1" width="16" height="16" rx="5" fill="#111"/><path d="M5 13V5h1.5L9 8.2 11.5 5H13v8h-1.8V7.9L9 10.7 6.8 7.9V13z" fill="#fff"/></svg>'
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 18, height: 18 })
}

function showPanel() {
  if (!window || window.isDestroyed()) createPanel()
  if (window.isVisible()) { window.hide(); return }
  if (settings.presentation === 'window') {
    window.show()
    window.focus()
    if (!activeView) activateTab(activeTabId)
    else updateBounds()
    sendState()
    return
  }
  const trayBounds = tray.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 })
  const area = display.workArea
  const x = Math.max(area.x + 8, Math.min(Math.round(trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2), area.x + area.width - PANEL_WIDTH - 8))
  const y = Math.max(area.y + 8, Math.min(trayBounds.y + trayBounds.height + 5, area.y + area.height - PANEL_HEIGHT - 8))
  window.setBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT }, false)
  window.show()
  window.focus()
  if (!activeView) activateTab(activeTabId)
  else updateBounds()
  sendState()
}

function createPanel() {
  const normalWindow = settings.presentation === 'window'
  window = new BrowserWindow({
    width: normalWindow ? 1100 : PANEL_WIDTH, height: normalWindow ? 760 : PANEL_HEIGHT, show: false,
    title: 'Just Browse', frame: normalWindow, resizable: true,
    minWidth: normalWindow ? 640 : 420, minHeight: normalWindow ? 480 : 320,
    alwaysOnTop: normalWindow ? false : true, skipTaskbar: !normalWindow,
    backgroundColor: '#f5f5f7',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  installKeyboardShortcuts(window.webContents)
  const mainWindow = window
  if (!normalWindow) window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  void window.loadFile(path.join(__dirname, 'index.html'))
  window.on('resize', updateBounds)
  window.on('blur', () => { if (mainPage === 'browser' && settings.presentation === 'panel' && settings.closeOnBlur && !pinned) window?.hide() })
  window.on('closed', () => {
    if (mainWindow._preserveViewsOnClose) return
    for (const [id, view] of views) if (!detachedWindows.has(id)) { disposeView(view); views.delete(id) }
    activeView = undefined
    window = undefined
  })
}

function rebuildMainWindow() {
  const previous = window
  if (previous && !previous.isDestroyed()) {
    if (activeView) {
      try { previous.contentView.removeChildView(activeView) } catch { /* already detached */ }
    }
    previous._preserveViewsOnClose = true
    window = undefined
    previous.close()
  }
  if (process.platform === 'darwin') {
    if (settings.presentation === 'window') app.dock?.show()
    else app.dock?.hide()
  }
  createPanel()
  activeView = undefined
  activateTab(activeTabId)
  if (settings.presentation === 'window') { window.show(); window.focus() }
}

function handleDeepLink(raw) {
  let parsed
  try { parsed = new URL(raw) } catch { return }
  if (!['justbrowse:', 'menubrowser:'].includes(parsed.protocol) || parsed.hostname !== 'open' || parsed.pathname !== '/') return
  let target
  try { target = normalizedUrl(parsed.searchParams.get('url')) } catch (error) { console.warn('Rejected deep link:', error.message); return }
  if (!target) return
  if (!window || window.isDestroyed()) createPanel()
  if (!window.isVisible()) showPanel()
  const width = Number.parseInt(parsed.searchParams.get('width') || '', 10)
  const height = Number.parseInt(parsed.searchParams.get('height') || '', 10)
  if (Number.isFinite(width) || Number.isFinite(height)) {
    const bounds = window.getBounds()
    window.setSize(Math.max(420, Math.min(1100, Number.isFinite(width) ? width : bounds.width)), Math.max(320, Math.min(1000, Number.isFinite(height) ? height : bounds.height)))
  }
  const recordId = createNewTab('')
  if (typeof recordId !== 'string') return
  navigate(target)
}

app.on('open-url', (event, url) => { event.preventDefault(); handleDeepLink(url) })
for (const scheme of ['justbrowse', 'menubrowser']) {
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])])
  else app.setAsDefaultProtocolClient(scheme)
}

function requirePanel(event) { return Boolean(window && !window.isDestroyed() && event.sender.id === window.webContents.id) }
function requireSettingsWindow(event) {
  return Boolean((settingsWindow && !settingsWindow.isDestroyed() && event.sender.id === settingsWindow.webContents.id)
    || (mainPage === 'settings' && window && !window.isDestroyed() && event.sender.id === window.webContents.id))
}

app.whenReady().then(() => {
  loadStore()
  if (process.platform === 'darwin') {
    if (settings.presentation === 'window') app.dock?.show()
    else app.dock?.hide()
  }
  browserSession = session.fromPartition(SESSION_PARTITION)
  configureSitePermissions(browserSession)
  browserSession.on('will-download', (event, item) => {
    let downloadUrl
    try { downloadUrl = new URL(item.getURL()) } catch { event.preventDefault(); return }
    const chain = item.getURLChain()
    const restored = [...resumeQueue.entries()].find(([, record]) => record.urlChain?.at(-1) === chain.at(-1))
    if ((!item.hasUserGesture() && !restored) || (downloadUrl.protocol !== 'https:' && !(downloadUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(downloadUrl.hostname)))) { event.preventDefault(); return }
    const safeName = path.basename(item.getFilename()).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'download'
    let record
    if (restored) { record = restored[1]; resumeQueue.delete(restored[0]) }
    else {
      item.setSaveDialogOptions({ defaultPath: path.join(settings.downloadDirectory || app.getPath('downloads'), safeName) })
      record = { id: crypto.randomUUID(), filename: safeName, url: chain.at(-1), urlChain: chain, mimeType: item.getMimeType(), path: '', state: 'progressing', receivedBytes: 0, totalBytes: 0, percent: 0, speed: 0, paused: false, lastModified: item.getLastModifiedTime(), eTag: item.getETag(), startTime: item.getStartTime(), updatedAt: Date.now() }
      downloadRecords.unshift(record); downloadRecords = downloadRecords.slice(0, 50)
    }
    attachDownload(item, record)
    const restorePath = record.path
    if (restorePath) item.setSavePath(restorePath)
    if (restored) item.resume()
  })
  createPanel()
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Just Browse')
  tray.on('click', showPanel)
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate([
    { label: 'New Tab', accelerator: settings.shortcuts.newTab || undefined, click: () => { if (!window || window.isDestroyed()) createPanel(); if (!window.isVisible()) showPanel(); createNewTab() } },
    { type: 'separator' },
    { label: 'Show / Hide', accelerator: panelShortcut, click: showPanel },
    { label: 'Settings…', accelerator: settings.shortcuts.settings || undefined, click: showSettingsPage },
    { label: 'Quit Just Browse', role: 'quit' }
  ])))
  registerPanelShortcut(panelShortcut)
  activateTab(activeTabId)
  if (settings.presentation === 'window') { window.show(); window.focus() }
  for (const argument of process.argv.slice(1)) if (/^(justbrowse|menubrowser):\/\//.test(argument)) handleDeepLink(argument)
})

ipcMain.handle('app:state', (event) => requirePanel(event) ? ({ tabs: tabs.map((tab) => ({ ...tab, detached: detachedWindows.has(tab.id) })), bookmarks: bookmarkItems, searchEngine, settings: publicSettings(), activeTabId, pinned, muted: Boolean(activeView?.webContents.isAudioMuted()), canGoBack: Boolean(activeView?.webContents.navigationHistory.canGoBack()), canGoForward: Boolean(activeView?.webContents.navigationHistory.canGoForward()) }) : null)
ipcMain.handle('tab:navigate', (event, value) => requirePanel(event) ? navigate(value) : null)
ipcMain.handle('tab:new', (event, value = '') => {
  if (!requirePanel(event)) return null
  return createNewTab(value || settings.homepage)
})
ipcMain.handle('tab:activate', (event, id) => { if (requirePanel(event)) activateTab(id) })
ipcMain.handle('tab:close', (event, id) => { if (requirePanel(event)) closeTab(id) })
ipcMain.handle('tab:home', (event) => { if (requirePanel(event)) goHome() })
ipcMain.handle('tab:toggle-mute', (event) => { if (requirePanel(event)) toggleMute() })
ipcMain.handle('browser:menu', (event) => { if (requirePanel(event)) showBrowserMenu() })
ipcMain.handle('settings:open', (event) => { if (requirePanel(event)) showSettingsPage() })
ipcMain.handle('tab:hard-reload', (event) => { if (requirePanel(event)) activeView?.webContents.reloadIgnoringCache() })
ipcMain.handle('tab:close-current', (event) => { if (requirePanel(event)) closeTab(activeTabId) })
ipcMain.handle('tab:refresh-interval', (event, seconds) => { if (requirePanel(event)) setRefreshInterval(activeTabId, seconds) })
ipcMain.handle('tab:zoom', (event, delta) => { if (requirePanel(event) && [-0.5, 0.5].includes(delta)) adjustZoom(delta) })
ipcMain.handle('tab:zoom-reset', (event) => { if (requirePanel(event)) resetZoom() })
ipcMain.handle('tab:detach', (event, id) => { if (requirePanel(event)) toggleTabDetachment(id) })
ipcMain.handle('tab:back', (event) => { if (requirePanel(event) && activeView?.webContents.navigationHistory.canGoBack()) activeView.webContents.navigationHistory.goBack() })
ipcMain.handle('tab:forward', (event) => { if (requirePanel(event) && activeView?.webContents.navigationHistory.canGoForward()) activeView.webContents.navigationHistory.goForward() })
ipcMain.handle('tab:reload', (event) => { if (requirePanel(event)) activeView?.webContents.reload() })
ipcMain.handle('window:toggle-pin', (event) => { if (requirePanel(event)) { pinned = !pinned; window.setAlwaysOnTop(pinned, 'screen-saver'); sendState() } })
ipcMain.handle('window:hide', (event) => { if (requirePanel(event)) window.hide() })
ipcMain.handle('bookmark:add', (event) => {
  if (!requirePanel(event)) return
  const tab = activeTab()
  if (!tab.url || bookmarkItems.some((item) => item.url === tab.url)) return
  bookmarkItems.push({ title: tab.title || safeHost(tab.url), url: tab.url, icon: (tab.title || safeHost(tab.url)).trim().slice(0, 1).toUpperCase() })
  saveSoon(); sendState()
})
ipcMain.handle('bookmark:open', (event, url) => {
  if (!requirePanel(event) || !bookmarkItems.some((item) => item.url === url)) return
  return navigate(url)
})
ipcMain.handle('bookmark:remove', (event, url) => {
  if (!requirePanel(event)) return
  bookmarkItems = bookmarkItems.filter((item) => item.url !== url)
  saveSoon(); sendState()
})
ipcMain.handle('bookmark:save', (event, input = {}) => {
  if (!requirePanel(event)) return null
  const url = normalizeStoredUrl(input.url)
  if (!url) return { error: 'Use a valid HTTPS website address.' }
  const originalUrl = normalizeStoredUrl(input.originalUrl)
  const currentIndex = originalUrl ? bookmarkItems.findIndex((item) => item.url === originalUrl) : -1
  if (currentIndex < 0 && bookmarkItems.some((item) => item.url === url)) return { error: 'That website is already a favorite.' }
  if (currentIndex >= 0 && bookmarkItems.some((item, index) => index !== currentIndex && item.url === url)) return { error: 'That website is already a favorite.' }
  const title = String(input.title || '').trim().slice(0, 80) || safeHost(url)
  const icon = String(input.icon || '').replace(/[\r\n\0]/g, '').trim().slice(0, 8) || title.slice(0, 1).toUpperCase()
  const item = { title, url, icon }
  if (currentIndex >= 0) bookmarkItems[currentIndex] = item
  else bookmarkItems.push(item)
  saveSoon(); sendState()
  return { ok: true }
})
ipcMain.handle('bookmark:move', (event, url, offset) => {
  if (!requirePanel(event) || ![-1, 1].includes(offset)) return false
  const index = bookmarkItems.findIndex((item) => item.url === url)
  const next = index + offset
  if (index < 0 || next < 0 || next >= bookmarkItems.length) return false
  ;[bookmarkItems[index], bookmarkItems[next]] = [bookmarkItems[next], bookmarkItems[index]]
  saveSoon(); sendState()
  return true
})
ipcMain.handle('settings:state', (event) => requireSettingsWindow(event) ? publicSettings() : null)
ipcMain.handle('settings:save', (event, input) => requireSettingsWindow(event) ? saveSettings(input) : null)
ipcMain.handle('settings:reset', (event) => requireSettingsWindow(event) ? resetSettings() : null)
ipcMain.handle('settings:revoke-site-permission', (event, origin, permission) => requireSettingsWindow(event) ? revokeSitePermission(origin, permission) : false)
ipcMain.handle('settings:close', (event) => { if (requireSettingsWindow(event)) closeSettingsPage() })
ipcMain.handle('settings:choose-download-folder', async (event) => {
  if (!requireSettingsWindow(event)) return null
  const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : window
  const result = await dialog.showOpenDialog(parentWindow, { title: 'Choose Download Folder', defaultPath: settings.downloadDirectory || app.getPath('downloads'), properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('downloads:state', (event) => downloadsWindow && !downloadsWindow.isDestroyed() && event.sender.id === downloadsWindow.webContents.id ? publishDownloads() : [])
ipcMain.handle('downloads:action', async (event, id, action) => {
  if (!downloadsWindow || downloadsWindow.isDestroyed() || event.sender.id !== downloadsWindow.webContents.id) return { error: 'Not allowed.' }
  const record = downloadRecords.find((item) => item.id === id)
  if (!record) return { error: 'Download not found.' }
  const item = liveDownloads.get(id)
  if (action === 'pause' && item && !item.isPaused()) { item.pause(); return { ok: true } }
  if (action === 'resume' && item?.isPaused()) { item.resume(); return { ok: true } }
  if (action === 'resume' && item?.canResume()) { item.resume(); return { ok: true } }
  if (action === 'cancel' && item) { item.cancel(); return { ok: true } }
  if (action === 'show' && record.path && fs.existsSync(record.path)) { shell.showItemInFolder(record.path); return { ok: true } }
  if (action === 'resume' && record.state === 'interrupted' && record.path && record.urlChain?.length && record.receivedBytes > 0) {
    const key = `${id}:${Date.now()}`
    resumeQueue.set(key, record)
    try { browserSession.createInterruptedDownload({ path: record.path, urlChain: record.urlChain, mimeType: record.mimeType || '', offset: record.receivedBytes, length: record.totalBytes, lastModified: record.lastModified || '', eTag: record.eTag || '', startTime: record.startTime || '' }); return { ok: true } }
    catch (error) { resumeQueue.delete(key); return { error: error.message } }
  }
  return { error: 'This download cannot be resumed. The server may not support byte-range requests.' }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  for (const [id, item] of liveDownloads) {
    const record = downloadRecords.find((entry) => entry.id === id)
    if (record && !item.isDone()) downloadSnapshot(item, record)
  }
  for (const timer of refreshTimers.values()) clearInterval(timer)
  refreshTimers.clear()
  for (const timer of idleDiscardTimers.values()) clearTimeout(timer)
  idleDiscardTimers.clear()
  flushStore()
})
app.on('window-all-closed', (event) => { event.preventDefault() })
