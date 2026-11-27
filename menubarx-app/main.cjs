const { app, BrowserWindow, WebContentsView, Menu, nativeImage, nativeTheme, screen, globalShortcut, ipcMain, shell, session, clipboard, dialog, systemPreferences, powerSaveBlocker } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')
const { createWorker } = require('tesseract.js')
const headlessUiTest = process.env.FLOA_UI_TEST === '1'
const englishOcrData = require('@tesseract.js-data/eng')
const koreanOcrData = require('@tesseract.js-data/kor')

const userDataOverride = process.env.FLOA_USER_DATA_DIR || app.commandLine.getSwitchValue('user-data-dir')
const existingUserDataPath = userDataOverride || path.join(app.getPath('appData'), 'Just Browse')
app.setName('Floa')
app.setPath('userData', existingUserDataPath)
if (process.platform === 'win32') app.setAppUserModelId('com.justchat.justbrowse')
for (const scheme of ['justbrowse', 'menubrowser']) {
  if (process.defaultApp && process.argv[1]) app.removeAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])])
  else app.removeAsDefaultProtocolClient(scheme)
}

const PANEL_WIDTH = 660
const PANEL_HEIGHT = 570
const TOOLBAR_HEIGHT = 46
const TAB_STRIP_HEIGHT = 38
const SHELL_HEIGHT = TOOLBAR_HEIGHT + TAB_STRIP_HEIGHT
const SEARCH_ENGINES = [
  { id: 'google', label: 'Google', queryUrl: 'https://www.google.com/search?q=' },
  { id: 'duckduckgo', label: 'DuckDuckGo', queryUrl: 'https://duckduckgo.com/?q=' },
  { id: 'bing', label: 'Bing', queryUrl: 'https://www.bing.com/search?q=' }
]
const SESSION_PARTITION = 'persist:menubarx-profile'
const REFRESH_INTERVALS = [0, 15, 30, 60, 300]
const SHORTCUT_DEFINITIONS = [
  { id: 'togglePanel', label: 'Show or hide Floa', description: 'Global shortcut; works while another app is focused.', default: 'Alt+G', global: true },
  { id: 'followSpaces', label: 'Follow across Spaces', description: 'Global shortcut; works while another app is focused.', default: 'Alt+Command+F', global: true },
  { id: 'opacityDown', label: 'Decrease window opacity', default: 'Alt+Command+Comma', global: true },
  { id: 'opacityUp', label: 'Increase window opacity', default: 'Alt+Command+Period', global: true },
  { id: 'cleanMode', label: 'Toggle Clean Mode', default: 'Alt+Command+C', global: true },
  { id: 'clickThrough', label: 'Toggle click-through', default: 'Alt+Command+P', global: true },
  ...Array.from({ length: 5 }, (_, index) => ({ id: `windowPreset${index + 1}`, label: `Apply window preset ${index + 1}`, default: `Alt+CommandOrControl+${index + 1}`, global: true })),
  ...Array.from({ length: 5 }, (_, index) => ({ id: `saveWindowPreset${index + 1}`, label: `Save window preset ${index + 1}`, default: `Alt+Shift+CommandOrControl+${index + 1}`, global: true })),
  { id: 'resetWindowPresets', label: 'Reset window layout and presets', default: 'Alt+CommandOrControl+0', global: true },
  { id: 'moveWindowLeft', label: 'Move window left', default: 'Alt+CommandOrControl+Left', global: true },
  { id: 'moveWindowRight', label: 'Move window right', default: 'Alt+CommandOrControl+Right', global: true },
  { id: 'moveWindowUp', label: 'Move window up', default: 'Alt+CommandOrControl+Up', global: true },
  { id: 'moveWindowDown', label: 'Move window down', default: 'Alt+CommandOrControl+Down', global: true },
  { id: 'openLocalVideo', label: 'Open local video', default: 'Alt+Command+O', global: true },
  { id: 'mediaMute', label: 'Mute or unmute the whole app', default: 'Alt+Command+M', global: true },
  { id: 'mediaVolumeDown', label: 'Decrease local video volume', default: 'Alt+Command+-', global: true },
  { id: 'mediaVolumeUp', label: 'Increase local video volume', default: 'Alt+Command+=', global: true },
  { id: 'openBrowserWorkspace', label: 'Open Browser tab', default: 'Alt+Command+B', global: true },
  { id: 'openNotes', label: 'Open Notes', default: 'Alt+Command+N', global: true },
  { id: 'cycleWorkspace', label: 'Cycle Browser, Notes, and Reader', default: 'Alt+Command+S', global: true },
  { id: 'nextTabGlobal', label: 'Select next Floa tab from any app', default: 'Alt+Command+Tab', global: true },
  { id: 'previousTabGlobal', label: 'Select previous Floa tab from any app', default: 'Alt+Shift+Command+Tab', global: true },
  { id: 'quitApp', label: 'Quit Floa', default: 'Alt+Command+X', global: true },
  { id: 'focusAddressGlobal', label: 'Focus address bar from any app', description: 'Global shortcut; works while another app is focused.', default: 'CommandOrControl+/', global: true },
  { id: 'shortcutsSettings', label: 'Open Settings shortcuts', default: 'CommandOrControl+Shift+/' },
  { id: 'noteNew', label: 'New note', default: 'CommandOrControl+N', noteOnly: true },
  { id: 'noteNewAlternate', label: 'New note', default: 'CommandOrControl+T', noteOnly: true },
  { id: 'noteDuplicate', label: 'Duplicate note', default: 'CommandOrControl+D', noteOnly: true },
  { id: 'noteSave', label: 'Save note now', default: 'CommandOrControl+S', noteOnly: true },
  { id: 'noteSaveAlternate', label: 'Save note now', default: 'CommandOrControl+R', noteOnly: true },
  { id: 'noteBold', label: 'Bold note text', default: 'CommandOrControl+B', noteOnly: true },
  { id: 'noteItalic', label: 'Italicize note text', default: 'CommandOrControl+I', noteOnly: true },
  { id: 'noteUnderline', label: 'Underline note text', default: 'CommandOrControl+U', noteOnly: true },
  { id: 'openReader', label: 'Open Book Reader', default: 'Alt+Command+R', global: true },
  { id: 'readerOpen', label: 'Import a book or document', default: 'CommandOrControl+O', readerOnly: true },
  { id: 'readerSearch', label: 'Find in book', default: 'CommandOrControl+F', readerOnly: true },
  { id: 'readerPrevious', label: 'Previous page', default: 'CommandOrControl+PageUp', readerOnly: true },
  { id: 'readerNext', label: 'Next page', default: 'CommandOrControl+PageDown', readerOnly: true },
  { id: 'readerZoomIn', label: 'Increase reading size', default: 'CommandOrControl+Plus', readerOnly: true },
  { id: 'readerZoomOut', label: 'Decrease reading size', default: 'CommandOrControl+-', readerOnly: true },
  { id: 'readerZoomReset', label: 'Reset reading size', default: 'CommandOrControl+0', readerOnly: true },
  { id: 'readerBookmark', label: 'Bookmark reading position', default: 'CommandOrControl+D', readerOnly: true },
  { id: 'findInPage', label: 'Find in page', default: 'CommandOrControl+F' },
  { id: 'newTab', label: 'New tab', default: 'CommandOrControl+T' },
  { id: 'closeTab', label: 'Close tab', default: 'CommandOrControl+W' },
  { id: 'hideWindow', label: 'Hide browser window', default: 'CommandOrControl+Shift+W' },
  { id: 'toggleSize', label: 'Expand or restore window', default: 'CommandOrControl+Shift+E' },
  { id: 'toggleFullscreen', label: 'Fill or restore current screen', default: 'CommandOrControl+Shift+F' },
  { id: 'focusAddress', label: 'Focus address bar', default: 'CommandOrControl+L' },
  { id: 'startPage', label: 'Open start page', default: 'CommandOrControl+Shift+H' },
  { id: 'reload', label: 'Reload page', default: 'CommandOrControl+R' },
  { id: 'forceReload', label: 'Force reload without cache', default: 'CommandOrControl+Shift+R' },
  { id: 'nextTab', label: 'Select next browser or utility tab', default: 'Control+Tab' },
  { id: 'previousTab', label: 'Select previous browser or utility tab', default: 'Control+Shift+Tab' },
  ...Array.from({ length: 9 }, (_, index) => ({ id: `selectTab${index + 1}`, label: `Select tab ${index + 1}`, default: `CommandOrControl+${index + 1}` })),
  { id: 'back', label: 'Go back', default: 'CommandOrControl+[' },
  { id: 'forward', label: 'Go forward', default: 'CommandOrControl+]' },
  { id: 'zoomIn', label: 'Zoom in', default: 'CommandOrControl+Plus' },
  { id: 'zoomOut', label: 'Zoom out', default: 'CommandOrControl+-' },
  { id: 'zoomReset', label: 'Reset zoom', default: 'CommandOrControl+0' },
  { id: 'togglePin', label: 'Pin or unpin window', default: 'CommandOrControl+Shift+P' },
  { id: 'openExternal', label: 'Open page in default browser', default: 'CommandOrControl+Shift+O' },
  { id: 'settings', label: 'Open settings', default: 'CommandOrControl+Comma' },
  { id: 'downloads', label: 'Open downloads', default: 'CommandOrControl+Shift+J' },
  { id: 'history', label: 'Open browsing history', default: 'CommandOrControl+Y' }
]
const DEFAULT_SHORTCUTS = Object.fromEntries(SHORTCUT_DEFINITIONS.map(({ id, default: accelerator }) => [id, accelerator]))
const SITE_PERMISSIONS = new Set(['notifications', 'geolocation', 'camera', 'microphone'])
const PERMISSION_LABELS = { notifications: 'notifications', geolocation: 'your location', camera: 'your camera', microphone: 'your microphone' }
const TAB_DISCARD_CHOICES = [0, 5, 10, 30]
const DEFAULT_SETTINGS = {
  searchEngine: 'google', homepage: '',
  defaultRefreshSeconds: 0, defaultZoomLevel: 0, downloadDirectory: '',
  shortcuts: DEFAULT_SHORTCUTS, panelShortcut: 'Alt+G', globalShortcutsEnabled: true, restoreTabs: true, closeOnBlur: false, presentation: 'window', followSpaces: true, opacity: 1,
  discardIdleMinutes: 10, mediaVolume: 1, mediaMuted: false,
  windowPresets: Array.from({ length: 5 }, (_, index) => ({ name: ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Center'][index], bounds: null }))
}
let window
let isQuitting = false
let browserSession
let activeView
let mainPage = 'browser'
let settingsWindow
let presentationRebuildPending = false
let suppressPanelBlurUntil = 0
const views = new Map()
const restoredTabIds = new Set()
const idleDiscardTimers = new Map()
const registeredGlobalShortcuts = new Map()
let pinned = false
let cleanMode = false
let clickThrough = false
let findBarOpen = false
let appMuteEnabled = false
let workspaceMode = 'browser'
let stateRevision = 0
const workspaceViews = new Map()
let activeWorkspaceView
let settingsReturnWorkspace = 'browser'
let store
let tabs = []
let activeTabId = ''
let expandedPanelRestoreBounds = null
let panelScreenRestoreBounds = null
let bookmarkItems = []
let historyEntries = []
let sitePermissions = {}
let downloadRecords = []
const liveDownloads = new Map()
const resumeQueue = new Map()
let downloadsWindow
let historyWindow
let mediaWindow
let notes = []
let notesOcrWorkerPromise
let notesOcrShutdownInProgress = false
let readerDocuments = []
let currentMediaPath = ''
let currentMediaData = null
let mediaPowerSaveId = 0
const mediaResume = new Map()
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
  const retainedSettings = Object.fromEntries(Object.entries(savedSettings).filter(([key]) => !['userAgentProfile', 'userAgentCustom', 'defaultViewportProfile', 'maxTabs'].includes(key)))
  const shortcuts = Object.fromEntries(SHORTCUT_DEFINITIONS.map((definition) => {
    const legacyValue = definition.id === 'togglePanel' ? savedSettings.panelShortcut : undefined
    let savedValue = savedSettings.shortcuts?.[definition.id] ?? legacyValue ?? definition.default
    if (definition.id === 'newTab' && savedValue === 'CommandOrControl+N') savedValue = definition.default
    if (definition.id === 'togglePanel' && savedValue === 'Alt+X') savedValue = definition.default
    if (definition.id === 'focusAddressGlobal' && savedValue === 'Alt+Command+U') savedValue = definition.default
    if (definition.id === 'nextTab' && ['CommandOrControl+Tab', 'CommandOrControl+Shift+Right'].includes(savedValue)) savedValue = definition.default
    if (definition.id === 'previousTab' && ['CommandOrControl+Shift+Tab', 'CommandOrControl+Shift+Left'].includes(savedValue)) savedValue = definition.default
    return [definition.id, savedValue === '' && definition.id !== 'togglePanel' ? '' : normalizeAccelerator(savedValue) || definition.default]
  }))
  settings = {
    ...DEFAULT_SETTINGS,
    ...retainedSettings,
    shortcuts,
    searchEngine: SEARCH_ENGINES.some((engine) => engine.id === savedSettings.searchEngine) ? savedSettings.searchEngine : DEFAULT_SETTINGS.searchEngine,
    homepage: normalizeStoredUrl(savedSettings.homepage),
    defaultRefreshSeconds: REFRESH_INTERVALS.includes(savedSettings.defaultRefreshSeconds) ? savedSettings.defaultRefreshSeconds : 0,
    defaultZoomLevel: [-2, -1, 0, 1, 2].includes(savedSettings.defaultZoomLevel) ? savedSettings.defaultZoomLevel : 0,
    panelShortcut: shortcuts.togglePanel,
    globalShortcutsEnabled: typeof savedSettings.globalShortcutsEnabled === 'boolean' ? savedSettings.globalShortcutsEnabled : true,
    restoreTabs: typeof savedSettings.restoreTabs === 'boolean' ? savedSettings.restoreTabs : true,
    closeOnBlur: typeof savedSettings.closeOnBlur === 'boolean' ? savedSettings.closeOnBlur : true,
    presentation: 'window',
    followSpaces: typeof savedSettings.followSpaces === 'boolean' ? savedSettings.followSpaces : true,
    opacity: Number.isFinite(savedSettings.opacity) ? Math.min(1, Math.max(0.35, savedSettings.opacity)) : 1,
    mediaVolume: Number.isFinite(savedSettings.mediaVolume) ? Math.min(1, Math.max(0, savedSettings.mediaVolume)) : 1,
    mediaMuted: Boolean(savedSettings.mediaMuted),
    windowPresets: Array.from({ length: 5 }, (_, index) => {
      const savedPreset = Array.isArray(savedSettings.windowPresets) ? savedSettings.windowPresets[index] : null
      const defaultPreset = DEFAULT_SETTINGS.windowPresets[index]
      const bounds = savedPreset?.bounds
      const validBounds = bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) && bounds.width >= 420 && bounds.height >= 320
      return { name: String(savedPreset?.name || defaultPreset.name).replace(/[\r\n\0]/g, '').trim().slice(0, 32) || defaultPreset.name, bounds: validBounds ? { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) } : null }
    }),
    discardIdleMinutes: TAB_DISCARD_CHOICES.includes(savedSettings.discardIdleMinutes) ? savedSettings.discardIdleMinutes : DEFAULT_SETTINGS.discardIdleMinutes,
    downloadDirectory: isDirectory(savedSettings.downloadDirectory) ? savedSettings.downloadDirectory : app.getPath('downloads')
  }
  searchEngine = settings.searchEngine
  panelShortcut = settings.shortcuts.togglePanel
  tabs = Array.isArray(saved.tabs) && savedSettings.restoreTabs !== false ? saved.tabs : []
  bookmarkItems = Array.isArray(saved.bookmarks) ? saved.bookmarks : []
  historyEntries = Array.isArray(saved.history) ? saved.history.filter((entry) => entry && typeof entry.id === 'string' && normalizeStoredUrl(entry.url)).slice(0, 1000).map((entry) => {
    const timestamp = Number(entry.visitedAt)
    return { id: entry.id.slice(0, 100), url: normalizeStoredUrl(entry.url), title: String(entry.title || safeHost(entry.url)).slice(0, 300), visitedAt: Number.isFinite(timestamp) && Math.abs(timestamp) <= 8.64e15 ? timestamp : Date.now() }
  }) : []
  downloadRecords = Array.isArray(saved.downloads) ? saved.downloads.filter((item) => item && typeof item.id === 'string').slice(0, 50).map((item) => ({ ...item, state: item.state === 'progressing' ? 'interrupted' : item.state, paused: false })) : []
  notes = Array.isArray(saved.notes) ? saved.notes.filter((note) => note && typeof note.id === 'string').map((note) => ({ id: note.id, title: String(note.title || 'Untitled').slice(0, 200), content: typeof note.content === 'string' ? note.content.slice(0, 2_000_000) : '', createdAt: Number(note.createdAt) || Date.now(), updatedAt: Number(note.updatedAt) || Date.now() })) : []
  readerDocuments = Array.isArray(saved.readerDocuments) ? saved.readerDocuments.filter((doc) => doc && typeof doc.id === 'string' && typeof doc.path === 'string' && path.isAbsolute(doc.path)).map((doc) => ({ id: doc.id, path: doc.path, title: String(doc.title || path.basename(doc.path)).slice(0, 240), type: ['pdf', 'epub', 'txt', 'md', 'rtf', 'html'].includes(doc.type) ? doc.type : 'txt', lastLocation: String(doc.lastLocation || '').slice(0, 4000), lastPage: Math.max(1, Number(doc.lastPage) || 1), zoom: Math.min(2.5, Math.max(0.6, Number(doc.zoom) || 1)), mode: doc.mode === 'scroll' ? 'scroll' : 'paged', bookmarks: Array.isArray(doc.bookmarks) ? doc.bookmarks.slice(0, 500) : [], highlights: Array.isArray(doc.highlights) ? doc.highlights.slice(0, 500) : [], updatedAt: Number(doc.updatedAt) || Date.now() })) : []
  mediaResume.clear()
  if (saved.mediaResume && typeof saved.mediaResume === 'object' && !Array.isArray(saved.mediaResume)) {
    for (const [filePath, record] of Object.entries(saved.mediaResume).slice(-50)) {
      if (!path.isAbsolute(filePath) || !isSupportedVideo(filePath) || !Number.isFinite(record?.time) || !Number.isFinite(record?.size) || !Number.isFinite(record?.modifiedAt)) continue
      mediaResume.set(filePath, { time: Math.max(0, record.time), size: record.size, modifiedAt: record.modifiedAt, updatedAt: Number(record.updatedAt) || 0 })
    }
  }
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
  tabs = tabs.filter((tab) => tab && typeof tab.id === 'string').map((tab) => ({
    id: tab.id,
    url: normalizeStoredUrl(tab.url),
    title: typeof tab.title === 'string' ? tab.title.slice(0, 300) : safeHost(tab.url || ''),
    refreshSeconds: REFRESH_INTERVALS.includes(tab.refreshSeconds) ? tab.refreshSeconds : settings.defaultRefreshSeconds,
    zoomLevel: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].includes(tab.zoomLevel) ? tab.zoomLevel : settings.defaultZoomLevel,
    discarded: false,
    muted: Boolean(tab.muted)
  }))
  restoredTabIds.clear()
  if (savedSettings.restoreTabs !== false && Array.isArray(saved.tabs)) {
    for (const tab of tabs) if (tab.url) restoredTabIds.add(tab.id)
  }
  if (!tabs.length) tabs = [newTabRecord()]
  bookmarkItems = bookmarkItems.filter((item) => item && typeof item.url === 'string' && normalizeStoredUrl(item.url)).map((item) => ({ title: String(item.title || safeHost(item.url)).slice(0, 80), url: normalizeStoredUrl(item.url), icon: String(item.icon || item.title || safeHost(item.url)).replace(/[\r\n\0]/g, '').slice(0, 8), folder: String(item.folder || '').replace(/[\r\n\0]/g, '').trim().slice(0, 40) }))
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
  return { id: crypto.randomUUID(), url, title: url ? safeHost(url) : 'New Tab', refreshSeconds: settings.defaultRefreshSeconds, zoomLevel: settings.defaultZoomLevel, discarded: false, muted: false }
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

function isSupportedVideo(filePath) {
  return ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mpg', '.mpeg', '.ogv'].includes(path.extname(String(filePath || '')).toLowerCase())
}

function safeHost(url) {
  try { return new URL(url).hostname } catch { return 'New Tab' }
}

function chromeCanvasColor() {
  return nativeTheme.shouldUseDarkColors ? '#202124' : '#ffffff'
}

function normalizeAccelerator(value) {
  if (typeof value !== 'string') return null
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const keyAliases = { comma: ',', period: '.', slash: '/', minus: '-', plus: 'Plus', space: 'Space', tab: 'Tab', escape: 'Escape', esc: 'Escape', left: 'Left', right: 'Right', up: 'Up', down: 'Down', pageup: 'PageUp', pagedown: 'PageDown', enter: 'Enter', return: 'Enter' }
  const modifiers = new Map([['commandorcontrol', 'CommandOrControl'], ['cmdorctrl', 'CommandOrControl'], ['command', 'Command'], ['cmd', 'Command'], ['control', 'Control'], ['ctrl', 'Control'], ['alt', 'Alt'], ['option', 'Alt'], ['shift', 'Shift'], ['super', 'Super'], ['meta', 'Super']])
  const key = keyAliases[parts.at(-1).toLowerCase()] || parts.at(-1)
  const validKey = /^[A-Z0-9]$/i.test(key) || /^F([1-9]|1[0-9]|2[0-4])$/i.test(key) || [',', '.', '/', '-', 'Plus', 'Space', 'Tab', 'Escape', 'Left', 'Right', 'Up', 'Down', 'PageUp', 'PageDown', 'Enter', '[', ']', '~', '`', '=', ';', "'", '\\'].includes(key)
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
  const keyAliases = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', ' ': 'Space', Escape: 'Escape', Enter: 'Enter', ',': ',', '.': '.', '+': 'Plus', '?': '/' }
  const eventKey = keyAliases[input.key] || (input.key?.length === 1 ? input.key.toUpperCase() : input.key)
  return eventKey === key || (key === 'Plus' && input.code === 'Equal' && input.shift)
}

function installKeyboardShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return
    const isNotesWindow = Boolean(workspaceMode === 'notes' && contents.id === workspaceViews.get('notes')?.webContents.id)
    const isReaderWindow = Boolean(workspaceMode === 'reader' && contents.id === workspaceViews.get('reader')?.webContents.id)
    if (mainPage === 'settings' && !isNotesWindow && !isReaderWindow) return
    if (input.key === 'Escape' && mainPage === 'browser' && findBarOpen && (contents === window?.webContents || contents === views.get(activeTabId)?.webContents)) {
      event.preventDefault()
      window?.webContents.send('app:close-find')
      return
    }
    if (input.key === 'Escape' && cleanMode && (contents === window?.webContents || contents === views.get(activeTabId)?.webContents)) {
      event.preventDefault(); cleanMode = false; updateBounds(); sendState(); return
    }
    if (input.key === 'Escape' && mainPage === 'browser') {
      const activeContents = views.get(activeTabId)?.webContents
      if ((contents === window?.webContents || contents === activeContents) && isScreenFilled()) {
        event.preventDefault(); toggleScreenFill(); return
      }
      if ((contents === window?.webContents || contents === activeContents) && settings.presentation === 'panel') {
        event.preventDefault(); window?.hide(); return
      }
    }
    const definition = SHORTCUT_DEFINITIONS.find((item) => Boolean(item.noteOnly) === isNotesWindow && Boolean(item.readerOnly) === isReaderWindow && shortcutMatches(input, settings.shortcuts[item.id]))
    if (!definition) return
    if (mainPage === 'settings' && !isNotesWindow && !isReaderWindow && !['togglePanel', 'hideWindow', 'settings', 'shortcutsSettings'].includes(definition.id)) return
    event.preventDefault()
    const associatedTab = [...views.entries()].find(([, view]) => view.webContents.id === contents.id)?.[0]
      || activeTabId
    runShortcut(definition.id, associatedTab)
  })
}

function runShortcut(id, tabId = activeTabId) {
  const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
  switch (id) {
    case 'togglePanel': showPanel(); break
    case 'followSpaces': settings.followSpaces = !settings.followSpaces; applySpaceVisibility(); saveSoon(); sendState(); break
    case 'opacityDown': changeOpacity(-0.05); break
    case 'opacityUp': changeOpacity(0.05); break
    case 'cleanMode': if (workspaceMode === 'browser') { cleanMode = !cleanMode; updateBounds(); sendState() } break
    case 'clickThrough': toggleClickThrough(); break
    case 'resetWindowPresets': resetWindowPresets(); break
    case 'moveWindowLeft': moveWindow(-24, 0); break
    case 'moveWindowRight': moveWindow(24, 0); break
    case 'moveWindowUp': moveWindow(0, -24); break
    case 'moveWindowDown': moveWindow(0, 24); break
    case 'openLocalVideo': void openLocalVideo(); break
    case 'mediaMute': toggleAppMute(); break
    case 'mediaVolumeDown': setMediaVolume(settings.mediaVolume - 0.05); break
    case 'mediaVolumeUp': setMediaVolume(settings.mediaVolume + 0.05); break
    case 'openBrowserWorkspace': focusPanelForTabShortcut(); showBrowserWorkspace(); break
    case 'openNotes': focusPanelForTabShortcut(); showNotesWindow(); break
    case 'cycleWorkspace': focusPanelForTabShortcut(); cycleWorkspace(); break
    case 'nextTabGlobal': focusPanelForTabShortcut(); cycleUnifiedTab(1); break
    case 'previousTabGlobal': focusPanelForTabShortcut(); cycleUnifiedTab(-1); break
    case 'quitApp': app.quit(); break
    case 'focusAddressGlobal': case 'focusAddress': showBrowserWorkspace(true); break
    case 'shortcutsSettings': showSettingsPage(true); break
    case 'noteNew': case 'noteNewAlternate': workspaceViews.get('notes')?.webContents.send('notes:command', 'new'); break
    case 'noteDuplicate': workspaceViews.get('notes')?.webContents.send('notes:command', 'duplicate'); break
    case 'noteSave': case 'noteSaveAlternate': workspaceViews.get('notes')?.webContents.send('notes:command', 'save'); break
    case 'noteBold': workspaceViews.get('notes')?.webContents.send('notes:command', 'bold'); break
    case 'noteItalic': workspaceViews.get('notes')?.webContents.send('notes:command', 'italic'); break
    case 'noteUnderline': workspaceViews.get('notes')?.webContents.send('notes:command', 'underline'); break
    case 'openReader': focusPanelForTabShortcut(); showReaderWindow(); break
    case 'readerOpen': workspaceViews.get('reader')?.webContents.send('reader:command', 'open'); break
    case 'readerSearch': workspaceViews.get('reader')?.webContents.send('reader:command', 'search'); break
    case 'readerPrevious': workspaceViews.get('reader')?.webContents.send('reader:command', 'previous'); break
    case 'readerNext': workspaceViews.get('reader')?.webContents.send('reader:command', 'next'); break
    case 'readerZoomIn': workspaceViews.get('reader')?.webContents.send('reader:command', 'zoom-in'); break
    case 'readerZoomOut': workspaceViews.get('reader')?.webContents.send('reader:command', 'zoom-out'); break
    case 'readerZoomReset': workspaceViews.get('reader')?.webContents.send('reader:command', 'zoom-reset'); break
    case 'readerBookmark': workspaceViews.get('reader')?.webContents.send('reader:command', 'bookmark'); break
    case 'newTab': createNewTab(); break
    case 'closeTab': if (tabs.length > 1) closeTab(tabId); else window?.hide(); break
    case 'hideWindow': window?.hide(); break
    case 'toggleSize': toggleWindowSize(); break
    case 'toggleFullscreen': toggleScreenFill(); break
    case 'startPage': goHome(); break
    case 'findInPage':
      if (window && !window.isDestroyed()) {
        findBarOpen = true
        window.webContents.focus()
        void window.webContents.executeJavaScript("document.querySelector('#find-bar')?.removeAttribute('hidden'); document.querySelector('#find-query')?.focus(); document.querySelector('#find-query')?.select()")
      }
      break
    case 'reload': if (tabId === activeTabId) activeView?.webContents.reload(); else views.get(tabId)?.webContents.reload(); break
    case 'forceReload': if (tabId === activeTabId) activeView?.webContents.reloadIgnoringCache(); else views.get(tabId)?.webContents.reloadIgnoringCache(); break
    case 'nextTab': cycleUnifiedTab(1); break
    case 'previousTab': cycleUnifiedTab(-1); break
    case 'back': { const view = views.get(tabId); if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack(); break }
    case 'forward': { const view = views.get(tabId); if (view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward(); break }
    case 'zoomIn': if (tabId === activeTabId) adjustZoom(0.5); break
    case 'zoomOut': if (tabId === activeTabId) adjustZoom(-0.5); break
    case 'zoomReset': if (tabId === activeTabId) resetZoom(); break
    case 'togglePin': pinned = !pinned; window?.setAlwaysOnTop(pinned, 'screen-saver'); sendState(); break
    case 'openExternal': { const tab = tabs.find((item) => item.id === tabId); if (tab?.url) void shell.openExternal(tab.url); break }
    case 'settings': if (mainPage === 'settings') closeSettingsPage(); else showSettingsPage(); break
    case 'downloads': showDownloadsWindow(); break
    case 'history': showHistoryWindow(); break
    default: {
      const preset = id.match(/^windowPreset([1-5])$/)
      if (preset) { restoreWindowPreset(Number(preset[1]) - 1); break }
      const savePreset = id.match(/^saveWindowPreset([1-5])$/)
      if (savePreset) { saveWindowPreset(Number(savePreset[1]) - 1); break }
      const match = id.match(/^selectTab([1-9])$/)
      if (match && tabs[Number(match[1]) - 1]) activateTab(tabs[Number(match[1]) - 1].id)
    }
  }
}

function saveSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify({ tabs, activeTabId, bookmarks: bookmarkItems, history: historyEntries.slice(0, 1000), permissions: sitePermissions, settings, downloads: downloadRecords.slice(0, 50), mediaResume: Object.fromEntries(mediaResume), notes, readerDocuments }, null, 2), { mode: 0o600 }) } catch (error) { console.error('Could not save browser data:', error.message) }
  }, 250)
}

function flushStore() {
  clearTimeout(persistTimer)
  if (!store) return
  try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify({ tabs, activeTabId, bookmarks: bookmarkItems, history: historyEntries.slice(0, 1000), permissions: sitePermissions, settings, downloads: downloadRecords.slice(0, 50), mediaResume: Object.fromEntries(mediaResume), notes, readerDocuments }, null, 2), { mode: 0o600 }) }
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

function publishHistory() {
  const state = historyEntries.slice(0, 1000)
  if (historyWindow && !historyWindow.isDestroyed()) historyWindow.webContents.send('history:state', state)
  return state
}

function showHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) { historyWindow.show(); historyWindow.focus(); publishHistory(); return }
  historyWindow = new BrowserWindow({ width: 760, height: 680, minWidth: 560, minHeight: 420, show: false, title: 'History', webPreferences: { preload: path.join(__dirname, 'history-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  historyWindow.setMenuBarVisibility(false)
  installKeyboardShortcuts(historyWindow.webContents)
  historyWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  historyWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file:')) event.preventDefault() })
  void historyWindow.loadFile(path.join(__dirname, 'history.html'))
  historyWindow.once('ready-to-show', () => { if (!historyWindow.isDestroyed()) { historyWindow.show(); publishHistory() } })
  historyWindow.on('closed', () => { historyWindow = undefined })
}

function recordHistoryVisit(url, title = '') {
  const safeUrl = normalizeStoredUrl(url)
  if (!safeUrl) return null
  const now = Date.now()
  const latest = historyEntries[0]
  let entry
  if (latest?.url === safeUrl && now - latest.visitedAt < 30_000) {
    entry = latest
    entry.visitedAt = now
    if (title) entry.title = String(title).slice(0, 300)
  } else {
    entry = { id: crypto.randomUUID(), url: safeUrl, title: String(title || safeHost(safeUrl)).slice(0, 300), visitedAt: now }
    historyEntries.unshift(entry)
    historyEntries.length = Math.min(historyEntries.length, 1000)
  }
  saveSoon()
  publishHistory()
  return entry
}

function showNotesWindow() {
  if (!notes.length) createNote()
  showWorkspacePage('notes')
}

function createWorkspaceView(workspace) {
  let view = workspaceViews.get(workspace)
  if (view && !view.webContents.isDestroyed()) return view
  const page = { notes: 'notes.html', reader: 'reader.html' }[workspace]
  if (!page) return null
  view = new WebContentsView({ webPreferences: { partition: SESSION_PARTITION, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  workspaceViews.set(workspace, view)
  view.setBackgroundColor(chromeCanvasColor())
  installKeyboardShortcuts(view.webContents)
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  view.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`file://${path.join(__dirname, page)}`)) event.preventDefault()
  })
  void view.webContents.loadFile(path.join(__dirname, page), { query: { embedded: '1' } })
  return view
}

function showWorkspacePage(workspace, focusAddress = false, browserTabId = '') {
  if (!window || window.isDestroyed()) createPanel()
  if (activeWorkspaceView) {
    try { window.contentView.removeChildView(activeWorkspaceView) } catch { /* already detached */ }
    activeWorkspaceView = undefined
  }
  if (activeView) {
    try { window.contentView.removeChildView(activeView) } catch { /* already detached */ }
    activeView.setVisible(false)
  }
  workspaceMode = workspace
  mainPage = 'browser'
  if (workspace === 'browser') {
    activeView = undefined
    activateTab(browserTabId || activeTabId)
    if (focusAddress) {
      activeView?.webContents.blur()
      window.webContents.focus()
      void window.webContents.executeJavaScript("document.querySelector('#address')?.focus(); document.querySelector('#address')?.select()")
    } else activeView?.webContents.focus()
  } else {
    const view = createWorkspaceView(workspace)
    if (!view) return
    activeWorkspaceView = view
    view.setVisible(true)
    window.contentView.addChildView(view)
    updateBounds()
    view.webContents.focus()
  }
  sendState()
}

function createNote(source = null) {
  const now = Date.now()
  const note = { id: crypto.randomUUID(), title: source ? `${source.title} Copy`.slice(0, 200) : 'Untitled', content: source?.content || '', createdAt: now, updatedAt: now }
  notes.unshift(note)
  saveSoon(); publishNotes()
  return note
}

function publishNotes() {
  const ordered = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
  if (workspaceViews.get('notes') && !workspaceViews.get('notes').webContents.isDestroyed()) workspaceViews.get('notes').webContents.send('notes:state', ordered)
  return ordered
}

function publicReaderDocuments() {
  return readerDocuments.map(({ id, title, type, lastLocation, lastPage, zoom, mode, bookmarks, highlights, updatedAt }) => ({ id, title, type, lastLocation, lastPage, zoom, mode, bookmarks, highlights, updatedAt }))
}

function publishReaderState() {
  const state = publicReaderDocuments()
  if (workspaceViews.get('reader') && !workspaceViews.get('reader').webContents.isDestroyed()) workspaceViews.get('reader').webContents.send('reader:state', state)
  return state
}

function showReaderWindow() {
  showWorkspacePage('reader')
}

async function importReaderDocument() {
  const result = await dialog.showOpenDialog(window, { title: 'Import Book or Document', properties: ['openFile'], filters: [{ name: 'Books and documents', extensions: ['pdf', 'epub', 'txt', 'md', 'markdown', 'rtf', 'html', 'htm'] }] })
  if (result.canceled || !result.filePaths[0]) return null
  const source = result.filePaths[0]
  let stat
  try { stat = fs.statSync(source); if (!stat.isFile() || stat.size > 200 * 1024 * 1024) return { error: 'Choose a file smaller than 200 MB.' } }
  catch { return { error: 'This document cannot be read.' } }
  const extension = path.extname(source).slice(1).toLowerCase()
  const type = extension === 'htm' ? 'html' : extension === 'markdown' ? 'md' : extension
  const id = crypto.randomUUID()
  const libraryDirectory = path.join(app.getPath('userData'), 'Reader Library')
  const destination = path.join(libraryDirectory, `${id}.${extension}`)
  try { fs.mkdirSync(libraryDirectory, { recursive: true }); fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL) }
  catch (error) { return { error: `Could not add this document: ${error.message}` } }
  const document = { id, path: destination, title: path.basename(source, path.extname(source)).slice(0, 240), type, lastLocation: '', lastPage: 1, zoom: 1, mode: 'paged', bookmarks: [], highlights: [], updatedAt: Date.now() }
  readerDocuments.unshift(document)
  saveSoon(); publishReaderState()
  return { id: document.id }
}

function saveReaderLocation(id, state = {}) {
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return false
  doc.lastLocation = String(state.location || '').slice(0, 4000)
  doc.lastPage = Math.max(1, Number(state.page) || 1)
  doc.zoom = Math.min(2.5, Math.max(0.6, Number(state.zoom) || 1))
  doc.mode = state.mode === 'scroll' ? 'scroll' : 'paged'
  doc.updatedAt = Date.now()
  saveSoon()
  return true
}

function addReaderBookmark(id, state = {}) {
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return null
  const location = String(state.location || '').slice(0, 4000)
  if (!location || doc.bookmarks.some((item) => item.location === location)) return null
  const bookmark = { id: crypto.randomUUID(), location, page: Math.max(1, Number(state.page) || 1), label: String(state.label || `Page ${Math.max(1, Number(state.page) || 1)}`).slice(0, 120), createdAt: Date.now() }
  doc.bookmarks.unshift(bookmark)
  doc.bookmarks = doc.bookmarks.slice(0, 500)
  saveSoon(); publishReaderState()
  return bookmark
}

function saveReaderHighlight(id, input = {}) {
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return null
  const location = String(input.location || '').slice(0, 4000)
  const text = String(input.text || '').trim().slice(0, 2000)
  if (!location || !text || doc.highlights.some((item) => item.location === location)) return null
  const highlight = { id: crypto.randomUUID(), location, page: Math.max(1, Number(input.page) || 1), text, color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : '#fff1a6', createdAt: Date.now() }
  doc.highlights.unshift(highlight)
  doc.highlights = doc.highlights.slice(0, 500)
  saveSoon(); publishReaderState()
  return highlight
}

function updateNoteData(id, input = {}) {
  const note = notes.find((item) => item.id === id)
  if (!note) return null
  const content = String(input.content || '')
  if (content.length > 2_000_000) return null
  note.title = String(input.title || 'Untitled').replace(/[\r\n\0]/g, ' ').trim().slice(0, 200) || 'Untitled'
  note.content = content
  note.updatedAt = Date.now()
  saveSoon()
  return { id: note.id, title: note.title, content: note.content, updatedAt: note.updatedAt }
}

async function getNotesOcrWorker() {
  if (!notesOcrWorkerPromise) {
    notesOcrWorkerPromise = (async () => {
      const modelDirectory = path.join(app.getPath('userData'), 'OCR Models')
      const cacheDirectory = path.join(app.getPath('userData'), 'OCR Cache')
      fs.mkdirSync(modelDirectory, { recursive: true, mode: 0o700 })
      fs.mkdirSync(cacheDirectory, { recursive: true, mode: 0o700 })
      for (const [sourceDirectory, language] of [[englishOcrData.langPath, 'eng'], [koreanOcrData.langPath, 'kor']]) {
        const source = path.join(sourceDirectory, `${language}.traineddata.gz`)
        const destination = path.join(modelDirectory, `${language}.traineddata.gz`)
        if (!fs.existsSync(destination)) fs.copyFileSync(source, destination)
      }
      let workerRoot = path.dirname(require.resolve('tesseract.js'))
      if (app.isPackaged) workerRoot = workerRoot.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
      const workerPath = path.join(workerRoot, 'worker-script', 'node', 'index.js')
      return createWorker(['eng', 'kor'], 1, {
        workerPath,
        langPath: modelDirectory,
        cachePath: cacheDirectory,
        gzip: true,
        logger: ({ status, progress }) => console.info(`[Notes OCR] ${status} (${Math.round(progress * 100)}%)`)
      })
    })().catch((error) => {
      notesOcrWorkerPromise = undefined
      throw error
    })
  }
  return notesOcrWorkerPromise
}

async function recognizeNoteImage(input) {
  if (typeof input !== 'string' || input.length > 1_400_000) return { error: 'This image is too large to scan.' }
  const match = /^data:image\/(png|jpeg|gif|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(input)
  if (!match) return { error: 'This image format is not supported for text search.' }
  const image = Buffer.from(match[2], 'base64')
  if (!image.length || image.length > 1_000_000) return { error: 'This image is too large to scan.' }
  try {
    const worker = await getNotesOcrWorker()
    const result = await worker.recognize(image)
    return { text: String(result.data.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 10_000) }
  } catch (error) {
    console.warn('Could not search text in a note image:', error.message)
    return { error: 'Could not read text in this image.' }
  }
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
    revision: ++stateRevision,
    tabs: tabs.map(({ id, url, title, refreshSeconds, discarded }) => ({ id, url, title, refreshSeconds, discarded })),
    bookmarks: bookmarkItems,
    searchEngine,
    settings: publicSettings(),
    workspace: workspaceMode,
    cleanMode,
    clickThrough,
    opacity: settings.opacity,
    activeTabId,
    pinned,
    expanded: settings.presentation === 'panel' ? Boolean(expandedPanelRestoreBounds) : Boolean(window.isMaximized()),
    screenFilled: isScreenFilled(),
    muted: Boolean(activeView && !activeView.webContents.isDestroyed() && activeView.webContents.isAudioMuted()),
    canGoBack: Boolean(activeView && activeView.webContents.navigationHistory.canGoBack()),
    canGoForward: Boolean(activeView && activeView.webContents.navigationHistory.canGoForward())
  }
  window.webContents.send('app:state-changed', state)
  for (const view of workspaceViews.values()) {
    if (!view.webContents.isDestroyed()) view.webContents.send('app:state-changed', state)
  }
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
  if (!window) return
  const [width, height] = window.getContentSize()
  const toolbarOffset = cleanMode ? 0 : SHELL_HEIGHT
  const bounds = { x: 0, y: toolbarOffset, width, height: Math.max(0, height - toolbarOffset) }
  if (workspaceMode !== 'browser' && activeWorkspaceView) {
    activeWorkspaceView.setBounds(bounds)
    return
  }
  if (!activeView) return
  activeView.setBounds(bounds)
}

function scheduleTabDiscard(id) {
  clearTimeout(idleDiscardTimers.get(id))
  idleDiscardTimers.delete(id)
  if (!settings.discardIdleMinutes) return
  const timer = setTimeout(() => {
    idleDiscardTimers.delete(id)
    const view = views.get(id)
    const record = tabs.find((tab) => tab.id === id)
    if (!view || !record || activeTabId === id || !record.url || view.webContents.isDestroyed() || view.webContents.isCurrentlyAudible()) return
    disposeView(view)
    views.delete(id)
    record.discarded = true
    clearInterval(refreshTimers.get(id)); refreshTimers.delete(id)
    saveSoon(); sendState()
  }, settings.discardIdleMinutes * 60_000)
  idleDiscardTimers.set(id, timer)
}

function createNewTab(url = settings.homepage) {
  const record = newTabRecord(url)
  tabs.push(record)
  activateTab(record.id)
  return record.id
}

function disposeView(view) {
  if (!view || view.webContents.isDestroyed()) return
  try { view.webContents.close() } catch { /* already closing */ }
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
  view.setBackgroundColor(chromeCanvasColor())
  const contents = view.webContents
  let currentHistoryId = ''
  let skipRestoredVisit = restoredTabIds.delete(record.id)
  contents.setAudioMuted(appMuteEnabled || Boolean(record.muted))
  installKeyboardShortcuts(contents)
  contents.setZoomLevel(Number.isFinite(record.zoomLevel) ? record.zoomLevel : settings.defaultZoomLevel)
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
    if (skipRestoredVisit) skipRestoredVisit = false
    else currentHistoryId = recordHistoryVisit(url, record.title)?.id || ''
    saveSoon(); sendState()
  })
  contents.on('did-navigate-in-page', (_event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return
    record.url = url
    currentHistoryId = recordHistoryVisit(url, contents.getTitle() || safeHost(url))?.id || ''
    saveSoon(); sendState()
  })
  contents.on('page-title-updated', (_event, title) => {
    record.title = title || safeHost(record.url)
    const entry = historyEntries.find((item) => item.id === currentHistoryId)
    if (entry && entry.title !== record.title) { entry.title = record.title.slice(0, 300); saveSoon(); publishHistory() }
    saveSoon(); sendState()
  })
  contents.on('found-in-page', (_event, result) => {
    if (record.id === activeTabId && window && !window.isDestroyed()) window.webContents.send('app:find-result', { requestId: result.requestId, activeMatchOrdinal: result.activeMatchOrdinal, matches: result.matches, finalUpdate: result.finalUpdate })
  })
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
  if (workspaceMode !== 'browser') { showWorkspacePage('browser', false, id); return }
  const target = tabs.find((tab) => tab.id === id)
  if (!target) return
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
  const tab = activeTab()
  tab.muted = !tab.muted
  activeView.webContents.setAudioMuted(appMuteEnabled || tab.muted)
  sendState()
}

function toggleAppMute() {
  appMuteEnabled = !appMuteEnabled
  for (const [id, view] of views) {
    if (view.webContents.isDestroyed()) continue
    const tab = tabs.find((item) => item.id === id)
    view.webContents.setAudioMuted(appMuteEnabled || Boolean(tab?.muted))
  }
  if (mediaWindow && !mediaWindow.isDestroyed()) mediaWindow.webContents.setAudioMuted(appMuteEnabled)
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
    { label: 'Find in Page', accelerator: settings.shortcuts.findInPage || undefined, click: () => runShortcut('findInPage') },
    { label: 'Open in Default Browser', accelerator: settings.shortcuts.openExternal || undefined, enabled: Boolean(tab.url), click: () => { if (tab.url) void shell.openExternal(tab.url) } },
    { label: 'Clear Site Data…', enabled: Boolean(safePermissionOrigin(tab.url)), click: () => { void clearCurrentSiteData() } },
    { label: 'Auto Refresh', submenu: REFRESH_INTERVALS.map((seconds) => ({ label: seconds ? `${seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds === 60 ? '' : 's'}`}` : 'Off', type: 'radio', checked: (tab.refreshSeconds || 0) === seconds, click: () => setRefreshInterval(tab.id, seconds) })) },
    { label: 'Zoom', submenu: [
      { label: 'Zoom In', accelerator: settings.shortcuts.zoomIn || undefined, click: () => adjustZoom(0.5) },
      { label: 'Zoom Out', accelerator: settings.shortcuts.zoomOut || undefined, click: () => adjustZoom(-0.5) },
      { label: 'Reset Zoom', accelerator: settings.shortcuts.zoomReset || undefined, click: resetZoom }
    ] },
    { type: 'separator' },
    { label: settings.presentation === 'panel' ? (expandedPanelRestoreBounds ? 'Restore Panel Size' : 'Expand Panel') : (window?.isMaximized() ? 'Restore Window' : 'Maximize Window'), accelerator: settings.shortcuts.toggleSize || undefined, click: toggleWindowSize },
    { label: isScreenFilled() ? 'Restore Screen Size' : 'Fill Current Screen', accelerator: settings.shortcuts.toggleFullscreen || undefined, click: toggleScreenFill },
    { label: 'Mute Website Audio', type: 'checkbox', checked: Boolean(activeTab()?.muted), click: toggleMute },
    { label: appMuteEnabled ? 'Unmute Floa' : 'Mute Floa', accelerator: settings.shortcuts.mediaMute || undefined, click: toggleAppMute },
    { label: 'Keep on Top', type: 'checkbox', checked: pinned, click: () => { pinned = !pinned; window.setAlwaysOnTop(pinned, 'screen-saver'); sendState() } },
    { label: 'Follow Across Spaces', type: 'checkbox', checked: settings.followSpaces, accelerator: settings.shortcuts.followSpaces || undefined, click: () => runShortcut('followSpaces') },
    { label: cleanMode ? 'Show Browser Controls' : 'Clean Mode', type: 'checkbox', checked: cleanMode, accelerator: settings.shortcuts.cleanMode || undefined, click: () => runShortcut('cleanMode') },
    { label: 'Click-through', type: 'checkbox', checked: clickThrough, enabled: clickThrough || isGlobalShortcutRegistered('clickThrough'), accelerator: settings.shortcuts.clickThrough || undefined, click: toggleClickThrough },
    { label: 'Window Opacity', submenu: [
      { label: 'Decrease opacity', accelerator: settings.shortcuts.opacityDown || undefined, click: () => changeOpacity(-0.05) },
      { label: `Current: ${Math.round(settings.opacity * 100)}%`, enabled: false },
      { label: 'Increase opacity', accelerator: settings.shortcuts.opacityUp || undefined, click: () => changeOpacity(0.05) },
      { label: 'Reset opacity', click: () => { settings.opacity = 1; window.setOpacity(1); saveSoon(); sendState() }
      }
    ] },
    { label: 'Window Positions', submenu: [
      ...settings.windowPresets.map((preset, index) => ({ label: `${index + 1} · ${preset.name}`, accelerator: settings.shortcuts[`windowPreset${index + 1}`] || undefined, enabled: Boolean(preset.bounds), click: () => restoreWindowPreset(index) })),
      { type: 'separator' },
      ...settings.windowPresets.map((preset, index) => ({ label: `Save current to ${index + 1} · ${preset.name}`, accelerator: settings.shortcuts[`saveWindowPreset${index + 1}`] || undefined, click: () => saveWindowPreset(index) })),
      { type: 'separator' },
      { label: 'Reset window layout and presets', accelerator: settings.shortcuts.resetWindowPresets || undefined, click: resetWindowPresets }
    ] },
    { label: 'Local Video', submenu: [
      { label: 'Open Video…', accelerator: settings.shortcuts.openLocalVideo || undefined, click: () => { void openLocalVideo() } },
      { label: settings.mediaMuted ? 'Unmute Video' : 'Mute Video', click: toggleMediaMute },
      { label: 'Decrease Video Volume', accelerator: settings.shortcuts.mediaVolumeDown || undefined, click: () => setMediaVolume(settings.mediaVolume - 0.05) },
      { label: 'Increase Video Volume', accelerator: settings.shortcuts.mediaVolumeUp || undefined, click: () => setMediaVolume(settings.mediaVolume + 0.05) }
    ] },
    { type: 'separator' },
    { label: 'Settings…', accelerator: settings.shortcuts.settings || undefined, click: showSettingsPage },
    { label: 'Downloads…', accelerator: settings.shortcuts.downloads || undefined, click: showDownloadsWindow },
    { label: 'History…', accelerator: settings.shortcuts.history || undefined, click: showHistoryWindow },
    { label: 'Notes…', accelerator: settings.shortcuts.openNotes || undefined, click: showNotesWindow },
    { label: 'Book Reader…', accelerator: settings.shortcuts.openReader || undefined, click: showReaderWindow },
    { label: 'Hide Window', accelerator: settings.shortcuts.hideWindow || undefined, click: () => window?.hide() },
    { label: 'Quit Floa', role: 'quit' }
  ]
  Menu.buildFromTemplate(template).popup({ window })
}

function showSettingsPage(focusShortcuts = false) {
  focusShortcuts = focusShortcuts === true
  const focusShortcutList = () => {
    const target = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : window
    if (target && !target.isDestroyed()) target.webContents.send('settings:focus-shortcuts')
  }
  if (!window || window.isDestroyed()) createPanel()
  if (!window.isVisible()) {
    if (settings.presentation === 'panel') showPanel()
    else { window.show(); window.focus() }
  }
  if (settings.presentation === 'window') {
    if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); if (focusShortcuts) focusShortcutList(); return }
    settingsWindow = new BrowserWindow({
      width: 620, height: 700, minWidth: 560, minHeight: 580, show: false,
      title: 'Floa Settings', backgroundColor: chromeCanvasColor(), parent: window, modal: true,
      webPreferences: { preload: path.join(__dirname, 'settings-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    settingsWindow.setMenuBarVisibility(false)
    void settingsWindow.loadFile(path.join(__dirname, 'settings.html'))
    settingsWindow.once('ready-to-show', () => { if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); if (focusShortcuts) focusShortcutList() } })
    settingsWindow.on('closed', () => {
      settingsWindow = undefined
      if (presentationRebuildPending) { presentationRebuildPending = false; rebuildMainWindow() }
      if (window && !window.isDestroyed()) { window.show(); window.focus() }
    })
    return
  }
  if (mainPage === 'settings') { window.show(); window.focus(); if (focusShortcuts) focusShortcutList(); return }
  settingsReturnWorkspace = workspaceMode
  mainPage = 'settings'
  if (activeView && !activeView.webContents.isDestroyed()) {
    activeView.setVisible(false)
    try { window.contentView.removeChildView(activeView) } catch { /* view was already detached */ }
  }
  if (activeWorkspaceView) {
    try { window.contentView.removeChildView(activeWorkspaceView) } catch { /* already detached */ }
    activeWorkspaceView = undefined
  }
  void window.loadFile(path.join(__dirname, 'settings.html')).then(() => { if (window && !window.isDestroyed()) { window.focus(); if (focusShortcuts) focusShortcutList() } })
}

function closeSettingsPage() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.close(); return }
  if (!window || window.isDestroyed() || mainPage !== 'settings') return
  const wasVisible = window.isVisible()
  mainPage = 'browser'
  const destination = settingsReturnWorkspace
  settingsReturnWorkspace = 'browser'
  workspaceMode = destination
  if (presentationRebuildPending) {
    presentationRebuildPending = false
    rebuildMainWindow()
    if (wasVisible && window && !window.isDestroyed()) { window.show(); window.focus() }
    return
  }
  void window.loadFile(path.join(__dirname, 'index.html')).then(() => {
    if (!window || window.isDestroyed()) return
    window.setTitle('Floa')
    if (destination !== 'browser') { showWorkspacePage(destination); if (wasVisible) window.show(); window.focus(); return }
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

function tryRegisterGlobalShortcut(shortcut, callback, id) {
  try {
    const registered = globalShortcut.register(shortcut, callback)
    if (registered) registeredGlobalShortcuts.set(shortcut, { callback, id })
    return registered
  } catch (error) {
    console.error(`[Floa] Invalid global shortcut ${shortcut}: ${error.message}`)
    return false
  }
}

function applySpaceVisibility() {
  const visible = Boolean(settings.followSpaces)
  if (window && !window.isDestroyed()) window.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: visible })
  if (mediaWindow && !mediaWindow.isDestroyed()) mediaWindow.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: visible })
}

function changeOpacity(delta) {
  settings.opacity = Math.round(Math.min(1, Math.max(0.35, settings.opacity + delta)) * 100) / 100
  if (window && !window.isDestroyed()) window.setOpacity(settings.opacity)
  saveSoon()
  sendState()
}

function toggleClickThrough() {
  if (!clickThrough && !isGlobalShortcutRegistered('clickThrough')) {
    window?.webContents.send('app:download-status', 'Enable the Click-through global shortcut in Settings to use Click-through.')
    return false
  }
  clickThrough = !clickThrough
  if (window && !window.isDestroyed()) window.setIgnoreMouseEvents(clickThrough, { forward: true })
  sendState()
}

async function openLocalVideo() {
  if (!window || window.isDestroyed()) createPanel()
  if (window && !window.isVisible()) showPanel()
  return chooseLocalVideo(window)
}

async function chooseLocalVideo(parent = window) {
  const result = await dialog.showOpenDialog(parent, {
    title: 'Open Local Video',
    properties: ['openFile'],
    filters: [{ name: 'Video files', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'ogv'] }]
  })
  if (result.canceled || !result.filePaths[0]) return false
  return openLocalVideoFile(result.filePaths[0])
}

function openLocalVideoFile(filePath) {
  if (!path.isAbsolute(filePath) || !isSupportedVideo(filePath)) return false
  let stat
  try {
    stat = fs.statSync(filePath)
    if (!stat.isFile()) return false
  } catch { return false }
  currentMediaPath = filePath
  const saved = mediaResume.get(filePath)
  const resumeAt = saved && saved.size === stat.size && saved.modifiedAt === stat.mtimeMs ? saved.time : 0
  const media = { src: pathToFileURL(filePath).href, title: path.basename(filePath), filePath, resumeAt, volume: settings.mediaVolume, muted: settings.mediaMuted }
  currentMediaData = media
  if (mediaWindow && !mediaWindow.isDestroyed()) {
    mediaWindow.setTitle(`Floa · ${media.title}`)
    if (mediaWindow._mediaReady) mediaWindow.webContents.send('media:open', media)
    if (!mediaWindow.isVisible()) mediaWindow.show()
    mediaWindow.focus()
    return true
  }
  mediaWindow = new BrowserWindow({
    width: 960, height: 600, minWidth: 420, minHeight: 300, show: false,
    title: `Floa · ${media.title}`, frame: true, resizable: true,
    alwaysOnTop: true, skipTaskbar: false, backgroundColor: '#08090b',
    webPreferences: { preload: path.join(__dirname, 'media-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false }
  })
  mediaWindow.setAlwaysOnTop(true, 'screen-saver')
  mediaWindow.setVisibleOnAllWorkspaces(Boolean(settings.followSpaces), { visibleOnFullScreen: Boolean(settings.followSpaces) })
  mediaWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const playerWindow = mediaWindow
  playerWindow.once('ready-to-show', () => { if (!playerWindow.isDestroyed()) { playerWindow.show(); playerWindow.focus() } })
  playerWindow.on('closed', () => {
    if (mediaPowerSaveId) powerSaveBlocker.stop(mediaPowerSaveId)
    mediaPowerSaveId = 0
    currentMediaPath = ''
    currentMediaData = null
    mediaWindow = undefined
  })
  void playerWindow.loadFile(path.join(__dirname, 'media-player.html')).then(() => {
    if (playerWindow.isDestroyed()) return
    playerWindow._mediaReady = true
    if (currentMediaData) playerWindow.webContents.send('media:open', currentMediaData)
  }).catch((error) => console.error('Could not open local video player:', error.message))
  return true
}

function saveMediaPosition(filePath, time) {
  if (!mediaWindow || mediaWindow.isDestroyed() || filePath !== currentMediaPath || !Number.isFinite(time)) return false
  let stat
  try { stat = fs.statSync(filePath) } catch { return false }
  mediaResume.delete(filePath)
  mediaResume.set(filePath, { time: Math.max(0, time), size: stat.size, modifiedAt: stat.mtimeMs, updatedAt: Date.now() })
  while (mediaResume.size > 50) mediaResume.delete(mediaResume.keys().next().value)
  saveSoon()
  return true
}

function setMediaPlaying(playing) {
  if (playing && !mediaPowerSaveId) mediaPowerSaveId = powerSaveBlocker.start('prevent-display-sleep')
  else if (!playing && mediaPowerSaveId) { powerSaveBlocker.stop(mediaPowerSaveId); mediaPowerSaveId = 0 }
}

function setMediaVolume(volume) {
  settings.mediaVolume = Math.round(Math.min(1, Math.max(0, Number(volume))) * 100) / 100
  if (mediaWindow && !mediaWindow.isDestroyed()) mediaWindow.webContents.send('media:volume', { volume: settings.mediaVolume, muted: settings.mediaMuted })
  saveSoon()
}

function toggleMediaMute() {
  settings.mediaMuted = !settings.mediaMuted
  if (mediaWindow && !mediaWindow.isDestroyed()) mediaWindow.webContents.send('media:volume', { volume: settings.mediaVolume, muted: settings.mediaMuted })
  saveSoon()
}

function saveWindowPreset(index, name = settings.windowPresets[index]?.name) {
  if (!Number.isInteger(index) || index < 0 || index >= 5 || !window || window.isDestroyed()) return false
  const cleanName = String(name || '').replace(/[\r\n\0]/g, '').trim().slice(0, 32)
  settings.windowPresets[index] = { name: cleanName || `Preset ${index + 1}`, bounds: window.getBounds() }
  saveSoon(); sendState()
  window.webContents.send('app:download-status', `Saved window position to ${settings.windowPresets[index].name}.`)
  return true
}

function restoreWindowPreset(index) {
  const preset = settings.windowPresets[index]
  if (!preset?.bounds || !window || window.isDestroyed()) return false
  restoreWindowBounds(boundsWithinWorkArea(preset.bounds, preset.bounds.width, preset.bounds.height))
  if (!window.isVisible() && !headlessUiTest) showPanel()
  window.webContents.send('app:download-status', `Restored window position: ${preset.name}.`)
  return true
}

function restoreWindowBounds(bounds) {
  if (!window || window.isDestroyed()) return
  const apply = () => { if (window && !window.isDestroyed()) window.setBounds(bounds) }
  if (window.isFullScreen()) {
    window.once('leave-full-screen', apply)
    window.setFullScreen(false)
    return
  }
  if (window.isMaximized()) window.unmaximize()
  apply()
}

function resetWindowPresets() {
  settings.windowPresets = DEFAULT_SETTINGS.windowPresets.map((preset) => ({ ...preset, bounds: null }))
  if (window && !window.isDestroyed()) {
    const area = screen.getDisplayMatching(window.getBounds()).workArea
    const bounds = boundsWithinWorkArea({ x: area.x + (area.width - 1100) / 2, y: area.y + (area.height - 760) / 2, width: 1100, height: 760 }, 1100, 760)
    restoreWindowBounds(bounds)
  }
  saveSoon(); sendState()
  window?.webContents.send('app:download-status', 'Window layout and position presets reset.')
  return publicSettings()
}

function moveWindow(dx, dy) {
  if (!window || window.isDestroyed()) return
  const bounds = window.getBounds()
  restoreWindowBounds(boundsWithinWorkArea({ ...bounds, x: bounds.x + dx, y: bounds.y + dy }, bounds.width, bounds.height))
}

function unregisterGlobalShortcut(shortcut) {
  if (!shortcut) return
  globalShortcut.unregister(shortcut)
  registeredGlobalShortcuts.delete(shortcut)
}

function unregisterGlobalShortcuts() {
  for (const shortcut of [...registeredGlobalShortcuts.keys()]) unregisterGlobalShortcut(shortcut)
}

function isGlobalShortcutRegistered(id) {
  const shortcut = settings.shortcuts[id]
  return Boolean(settings.globalShortcutsEnabled && shortcut && registeredGlobalShortcuts.get(shortcut)?.id === id)
}

function disableClickThrough(message) {
  if (!clickThrough) return
  clickThrough = false
  window?.setIgnoreMouseEvents(false)
  if (message) window?.webContents.send('app:download-status', message)
  sendState()
}

function registerGlobalShortcuts(shortcuts) {
  for (const definition of SHORTCUT_DEFINITIONS) {
    if (!definition.global) continue
    const accelerator = shortcuts[definition.id]
    if (!accelerator) continue
    const callback = definition.id === 'togglePanel' ? showPanel : () => runShortcut(definition.id)
    if (!tryRegisterGlobalShortcut(accelerator, callback, definition.id)) {
      unregisterGlobalShortcuts()
      return false
    }
  }
  const fallback = 'CommandOrControl+Shift+Space'
  if (!Object.values(shortcuts).includes(fallback)) tryRegisterGlobalShortcut(fallback, showPanel, 'togglePanel')
  panelShortcut = shortcuts.togglePanel
  return true
}

function replaceGlobalShortcuts(shortcuts) {
  const previousRegistrations = new Map(registeredGlobalShortcuts)
  const previousPanelShortcut = panelShortcut
  unregisterGlobalShortcuts()
  if (registerGlobalShortcuts(shortcuts)) return { applied: true }
  unregisterGlobalShortcuts()
  let restored = true
  for (const [shortcut, registration] of previousRegistrations) {
    if (!tryRegisterGlobalShortcut(shortcut, registration.callback, registration.id)) { restored = false; break }
  }
  if (!restored) unregisterGlobalShortcuts()
  panelShortcut = previousPanelShortcut
  if (restored) return { applied: false, previousRestored: true }
  settings.globalShortcutsEnabled = false
  disableClickThrough('Click-through turned off because its global exit shortcut could not be restored.')
  saveSoon()
  sendState()
  return { applied: false, previousRestored: false }
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
    const scope = definition.noteOnly ? 'notes' : definition.readerOnly ? 'reader' : 'browser'
    const previous = [...assigned.values()].find((entry) => entry.accelerator === accelerator && (entry.scope === scope || entry.global || definition.global))
    if (previous) return { error: `“${definition.label}” conflicts with “${previous.label}”.` }
    assigned.set(`${scope}:${accelerator}`, { ...definition, scope, accelerator })
  }
  const next = {
    ...settings,
    shortcuts,
    searchEngine: SEARCH_ENGINES.some((engine) => engine.id === input.searchEngine) ? input.searchEngine : settings.searchEngine,
    homepage,
    defaultRefreshSeconds: REFRESH_INTERVALS.includes(Number(input.defaultRefreshSeconds)) ? Number(input.defaultRefreshSeconds) : settings.defaultRefreshSeconds,
    defaultZoomLevel: [-2, -1, 0, 1, 2].includes(Number(input.defaultZoomLevel)) ? Number(input.defaultZoomLevel) : settings.defaultZoomLevel,
    mediaVolume: Number.isFinite(Number(input.mediaVolume)) ? Math.min(1, Math.max(0, Number(input.mediaVolume))) : settings.mediaVolume,
    mediaMuted: typeof input.mediaMuted === 'boolean' ? input.mediaMuted : settings.mediaMuted,
    discardIdleMinutes: TAB_DISCARD_CHOICES.includes(Number(input.discardIdleMinutes)) ? Number(input.discardIdleMinutes) : settings.discardIdleMinutes,
    opacity: Number.isFinite(Number(input.opacity)) ? Math.min(1, Math.max(0.35, Number(input.opacity))) : settings.opacity,
    windowPresets: settings.windowPresets.map((preset, index) => ({
      name: String(input[`presetName${index + 1}`] ?? preset.name).replace(/[\r\n\0]/g, '').trim().slice(0, 32) || `Preset ${index + 1}`,
      bounds: preset.bounds
    })),
    downloadDirectory: isDirectory(input.downloadDirectory) ? input.downloadDirectory : settings.downloadDirectory,
    restoreTabs: typeof input.restoreTabs === 'boolean' ? input.restoreTabs : settings.restoreTabs,
    closeOnBlur: typeof input.closeOnBlur === 'boolean' ? input.closeOnBlur : settings.closeOnBlur,
    presentation: 'window',
    followSpaces: typeof input.followSpaces === 'boolean' ? input.followSpaces : settings.followSpaces,
    globalShortcutsEnabled: typeof input.globalShortcutsEnabled === 'boolean' ? input.globalShortcutsEnabled : settings.globalShortcutsEnabled,
    panelShortcut: shortcuts.togglePanel
  }
  const wasGlobalShortcutsEnabled = settings.globalShortcutsEnabled
  if (wasGlobalShortcutsEnabled && !next.globalShortcutsEnabled) {
    unregisterGlobalShortcuts()
    disableClickThrough('Click-through turned off because global shortcuts were disabled.')
  } else if (!wasGlobalShortcutsEnabled && next.globalShortcutsEnabled) {
    if (!registerGlobalShortcuts(shortcuts)) return { error: 'A global shortcut is already being used by macOS or another app. Change the conflicting shortcut and try again.' }
  } else if (next.globalShortcutsEnabled && SHORTCUT_DEFINITIONS.some((definition) => definition.global && shortcuts[definition.id] !== settings.shortcuts[definition.id])) {
    const result = replaceGlobalShortcuts(shortcuts)
    if (!result.applied) return { error: result.previousRestored
      ? 'A global shortcut is already being used by macOS or another app. The previously active shortcuts were restored.'
      : 'A global shortcut is already being used by macOS or another app. The saved assignments remain, but global shortcuts were turned off.' }
  }
  const presentationChanged = settings.presentation !== next.presentation
  const discardPolicyChanged = settings.discardIdleMinutes !== next.discardIdleMinutes
  settings = next
  pinned = true
  if (window && !window.isDestroyed()) window.setOpacity(settings.opacity)
  if (mediaWindow && !mediaWindow.isDestroyed()) setMediaVolume(settings.mediaVolume)
  applySpaceVisibility()
  searchEngine = settings.searchEngine
  if (presentationChanged) {
    if (mainPage === 'settings' || (settingsWindow && !settingsWindow.isDestroyed())) presentationRebuildPending = true
    else rebuildMainWindow()
  }
  if (discardPolicyChanged) {
    for (const timer of idleDiscardTimers.values()) clearTimeout(timer)
    idleDiscardTimers.clear()
    for (const tab of tabs) if (tab.id !== activeTabId) scheduleTabDiscard(tab.id)
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
  const focusPanel = () => {
    suppressPanelBlurUntil = Date.now() + 700
    if (process.platform === 'darwin') app.focus({ steal: true })
    window.show()
    window.focus()
  }
  focusPanel()
  if (workspaceMode === 'browser') {
    if (!activeView) activateTab(activeTabId)
    else updateBounds()
    if (activeView?.getVisible()) activeView.webContents.focus()
    else window.webContents.focus()
  } else if (activeWorkspaceView && !activeWorkspaceView.webContents.isDestroyed()) activeWorkspaceView.webContents.focus()
  else window.webContents.focus()
  sendState()
}

function showBrowserWorkspace(focusAddress = false) {
  if (!window || window.isDestroyed()) createPanel()
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  else if (mainPage === 'settings') closeSettingsPage()
  if (workspaceMode !== 'browser') { showWorkspacePage('browser', focusAddress); window.show(); window.focus(); return }
  workspaceMode = 'browser'
  if (!window.isVisible()) window.show()
  if (process.platform === 'darwin') app.focus({ steal: true })
  window.focus()
  if (!activeView) activateTab(activeTabId)
  else updateBounds()
  if (activeView?.getVisible()) activeView.webContents.focus()
  else window.webContents.focus()
  if (focusAddress) {
    activeView?.webContents.blur()
    window.webContents.focus()
    void window.webContents.executeJavaScript("document.querySelector('#address')?.focus(); document.querySelector('#address')?.select()")
  }
  sendState()
}

function cycleWorkspace() {
  const sequence = ['browser', 'notes', 'reader']
  const next = sequence[(sequence.indexOf(workspaceMode) + 1) % sequence.length]
  if (next === 'browser') showBrowserWorkspace()
  else if (next === 'notes') showNotesWindow()
  else showReaderWindow()
}

function focusPanelForTabShortcut() {
  if (!window || window.isDestroyed()) createPanel()
  if (!window.isVisible()) showPanel()
  else {
    if (process.platform === 'darwin') app.focus({ steal: true })
    window.focus()
  }
}

function cycleUnifiedTab(direction) {
  const browserTabs = tabs
  const entries = [
    ...browserTabs.map((tab) => ({ workspace: 'browser', tabId: tab.id })),
    { workspace: 'notes' },
    { workspace: 'reader' }
  ]
  if (!entries.length) return
  const currentIndex = workspaceMode === 'browser'
    ? entries.findIndex((entry) => entry.workspace === 'browser' && entry.tabId === activeTabId)
    : entries.findIndex((entry) => entry.workspace === workspaceMode)
  const baseIndex = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex
  const next = entries[(baseIndex + direction + entries.length) % entries.length]
  if (next.workspace === 'browser') showWorkspacePage('browser', false, next.tabId)
  else showWorkspacePage(next.workspace)
}

function isScreenFilled() {
  if (!window || window.isDestroyed()) return false
  return settings.presentation === 'window' ? window.isFullScreen() : Boolean(panelScreenRestoreBounds)
}

function boundsWithinWorkArea(bounds, width, height) {
  const area = screen.getDisplayMatching(bounds).workArea
  const nextWidth = Math.max(420, Math.min(width, area.width - 16))
  const nextHeight = Math.max(320, Math.min(height, area.height - 16))
  const x = Math.max(area.x + 8, Math.min(Math.round(bounds.x + (bounds.width - nextWidth) / 2), area.x + area.width - nextWidth - 8))
  const y = Math.max(area.y + 8, Math.min(bounds.y, area.y + area.height - nextHeight - 8))
  return { x, y, width: nextWidth, height: nextHeight }
}

function toggleWindowSize() {
  if (!window || window.isDestroyed()) return
  if (isScreenFilled()) { toggleScreenFill(); return }
  if (settings.presentation === 'window') {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    sendState()
    return
  }
  if (expandedPanelRestoreBounds) {
    const restore = expandedPanelRestoreBounds
    expandedPanelRestoreBounds = null
    window.setBounds(restore)
  } else {
    expandedPanelRestoreBounds = window.getBounds()
    window.setBounds(boundsWithinWorkArea(expandedPanelRestoreBounds, 900, 740))
  }
  sendState()
}

function toggleScreenFill() {
  if (!window || window.isDestroyed()) return
  if (settings.presentation === 'window') {
    window.setFullScreen(!window.isFullScreen())
    sendState()
    return
  }
  if (panelScreenRestoreBounds) {
    const restore = panelScreenRestoreBounds
    panelScreenRestoreBounds = null
    window.setBounds(restore)
  } else {
    panelScreenRestoreBounds = window.getBounds()
    window.setBounds(screen.getDisplayMatching(panelScreenRestoreBounds).workArea)
  }
  sendState()
}

function createPanel() {
  const normalWindow = true
  pinned = true
  window = new BrowserWindow({
    width: headlessUiTest ? 420 : (normalWindow ? 1100 : PANEL_WIDTH), height: headlessUiTest ? 500 : (normalWindow ? 760 : PANEL_HEIGHT), show: false,
    title: 'Floa', frame: normalWindow, resizable: true,
    minWidth: headlessUiTest ? 420 : (normalWindow ? 640 : 420), minHeight: headlessUiTest ? 320 : (normalWindow ? 480 : 320),
    alwaysOnTop: true, skipTaskbar: false,
    backgroundColor: chromeCanvasColor(),
    webPreferences: { partition: SESSION_PARTITION, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  installKeyboardShortcuts(window.webContents)
  const mainWindow = window
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setOpacity(settings.opacity)
  window.setIgnoreMouseEvents(clickThrough, { forward: true })
  applySpaceVisibility()
  void window.loadFile(path.join(__dirname, 'index.html'))
  window.on('resize', updateBounds)
  window.on('maximize', sendState)
  window.on('unmaximize', sendState)
  window.on('enter-full-screen', sendState)
  window.on('leave-full-screen', sendState)
  window.on('blur', () => {
    if (Date.now() < suppressPanelBlurUntil) return
    if (mainPage === 'browser' && settings.presentation === 'panel' && settings.closeOnBlur && !pinned) window?.hide()
  })
  window.on('closed', () => {
    if (mainWindow._preserveViewsOnClose) return
    expandedPanelRestoreBounds = null
    panelScreenRestoreBounds = null
    for (const [id, view] of views) { disposeView(view); views.delete(id) }
    activeView = undefined
    for (const view of workspaceViews.values()) { try { view.webContents.close() } catch { /* already closed */ } }
    workspaceViews.clear(); activeWorkspaceView = undefined
    workspaceMode = 'browser'; mainPage = 'browser'
    window = undefined
  })
}

function rebuildMainWindow() {
  expandedPanelRestoreBounds = null
  panelScreenRestoreBounds = null
  const previous = window
  if (previous && !previous.isDestroyed()) {
    if (activeView) {
      try { previous.contentView.removeChildView(activeView) } catch { /* already detached */ }
    }
    if (activeWorkspaceView) {
      try { previous.contentView.removeChildView(activeWorkspaceView) } catch { /* already detached */ }
    }
    previous._preserveViewsOnClose = true
    window = undefined
    previous.close()
  }
  if (process.platform === 'darwin' && !headlessUiTest) app.dock?.show()
  createPanel()
  mainPage = 'browser'
  if (workspaceMode === 'browser') {
    activeWorkspaceView = undefined
    activeView = undefined
    activateTab(activeTabId)
  } else {
    activeView = undefined
    activeWorkspaceView = workspaceViews.get(workspaceMode)
    if (activeWorkspaceView && !activeWorkspaceView.webContents.isDestroyed()) {
      window.contentView.addChildView(activeWorkspaceView)
      activeWorkspaceView.setVisible(true)
      updateBounds()
    }
  }
  if (settings.presentation === 'window' && !headlessUiTest) { window.show(); window.focus() }
}

function senderOnLocalPage(event, filename) {
  try {
    if (!window || window.isDestroyed()) return false
    const page = path.join(__dirname, filename)
    const url = new URL(event.senderFrame.url)
    if (event.sender.id === window.webContents.id) return url.pathname === page
    const workspace = { 'notes.html': 'notes', 'reader.html': 'reader' }[filename]
    const view = workspaceViews.get(workspace)
    return Boolean(workspace && view && !view.webContents.isDestroyed() && event.sender.id === view.webContents.id && url.pathname === page)
  } catch { return false }
}
function requirePanel(event) { return senderOnLocalPage(event, 'index.html') }
function requireNotes(event) { return senderOnLocalPage(event, 'notes.html') }
function requireNotesSave(event) { return requireNotes(event) }
function requireReader(event) { return senderOnLocalPage(event, 'reader.html') }
function requireWorkspacePage(event) { return requirePanel(event) || requireNotes(event) || requireReader(event) }
function requireHistory(event) { return Boolean(historyWindow && !historyWindow.isDestroyed() && event.sender.id === historyWindow.webContents.id) }
function requireSettingsWindow(event) {
  return Boolean((settingsWindow && !settingsWindow.isDestroyed() && event.sender.id === settingsWindow.webContents.id)
    || (mainPage === 'settings' && window && !window.isDestroyed() && event.sender.id === window.webContents.id))
}

app.whenReady().then(() => {
  loadStore()
  if (process.platform === 'darwin' && !headlessUiTest) {
    app.dock?.show()
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
  if (!headlessUiTest && settings.globalShortcutsEnabled && !registerGlobalShortcuts(settings.shortcuts)) {
    settings.globalShortcutsEnabled = false
    settings.panelShortcut = settings.shortcuts.togglePanel
    saveSoon()
    console.error('[Floa] Global shortcuts were disabled because at least one configured shortcut could not be registered.')
  }
  activateTab(activeTabId)
  if (settings.presentation === 'window' && !headlessUiTest) { window.show(); window.focus() }
})

ipcMain.handle('workspace:state', (event) => requireWorkspacePage(event) ? ({ revision: stateRevision, tabs: tabs.map(({ id, url, title }) => ({ id, url, title })), activeTabId, workspace: workspaceMode }) : null)
if (headlessUiTest) {
  ipcMain.handle('test:rebuild-main-window', (event) => {
    if (!requireWorkspacePage(event)) return false
    rebuildMainWindow()
    return true
  })
  ipcMain.handle('test:resize-window', (event, width, height) => {
    if (!requireWorkspacePage(event) || !window || window.isDestroyed()) return false
    if (![width, height].every((value) => Number.isInteger(value) && value >= 320 && value <= 2000)) return false
    window.setSize(width, height)
    return true
  })
  ipcMain.handle('test:dispatch-key', (event, input = {}) => {
    if (!requireWorkspacePage(event) || !['keyDown', 'keyUp'].includes(input.type) || typeof input.key !== 'string') return false
    let prevented = false
    event.sender.emit('before-input-event', { preventDefault: () => { prevented = true } }, {
      type: input.type,
      key: input.key,
      code: input.code || '',
      isAutoRepeat: false,
      alt: Boolean(input.alt),
      control: Boolean(input.control),
      meta: Boolean(input.meta),
      shift: Boolean(input.shift)
    })
    return prevented
  })
}
ipcMain.handle('workspace:switch', (event, workspace) => { if (!['browser', 'notes', 'reader'].includes(workspace) || !requireWorkspacePage(event)) return false; if (workspace === 'browser') showBrowserWorkspace(); else showWorkspacePage(workspace); return true })
ipcMain.handle('workspace:activate-browser-tab', (event, id) => {
  if (!requireWorkspacePage(event) || typeof id !== 'string' || !tabs.some((tab) => tab.id === id)) return false
  if (workspaceMode === 'browser') activateTab(id)
  else showWorkspacePage('browser', false, id)
  return true
})
ipcMain.handle('app:state', (event) => requirePanel(event) ? ({ revision: stateRevision, tabs: tabs.map((tab) => ({ ...tab })), bookmarks: bookmarkItems, searchEngine, settings: publicSettings(), activeTabId, workspace: workspaceMode, pinned, cleanMode, clickThrough, opacity: settings.opacity, expanded: settings.presentation === 'panel' ? Boolean(expandedPanelRestoreBounds) : Boolean(window.isMaximized()), screenFilled: isScreenFilled(), muted: Boolean(activeView?.webContents.isAudioMuted()), canGoBack: Boolean(activeView?.webContents.navigationHistory.canGoBack()), canGoForward: Boolean(activeView?.webContents.navigationHistory.canGoForward()) }) : null)
ipcMain.handle('tab:navigate', (event, value) => requirePanel(event) ? navigate(value) : null)
ipcMain.handle('tab:new', (event, value = '') => {
  if (!requirePanel(event)) return null
  return createNewTab(value || settings.homepage)
})
ipcMain.handle('tab:activate', (event, id) => { if (requirePanel(event)) activateTab(id) })
ipcMain.handle('tab:close', (event, id) => { if (requirePanel(event)) closeTab(id) })
ipcMain.handle('tab:home', (event) => { if (requirePanel(event)) goHome() })
ipcMain.handle('tab:toggle-mute', (event) => { if (requirePanel(event)) toggleMute() })
ipcMain.handle('tab:find', (event, query, direction = 'new') => {
  if (!requirePanel(event) || !activeView || activeView.webContents.isDestroyed()) return null
  const text = String(query || '').slice(0, 500)
  if (!text) { activeView.webContents.stopFindInPage('clearSelection'); return { requestId: null } }
  const findNext = direction === 'new'
  return { requestId: activeView.webContents.findInPage(text, { forward: direction !== 'backward', findNext }) }
})
ipcMain.handle('tab:find-close', (event) => {
  if (!requirePanel(event)) return
  findBarOpen = false
  if (!activeView || activeView.webContents.isDestroyed()) return
  activeView.webContents.stopFindInPage('clearSelection')
  activeView.webContents.focus()
})
ipcMain.handle('browser:menu', (event) => { if (requirePanel(event)) showBrowserMenu() })
ipcMain.handle('settings:open', (event) => { if (requirePanel(event)) showSettingsPage() })
ipcMain.handle('tab:hard-reload', (event) => { if (requirePanel(event)) activeView?.webContents.reloadIgnoringCache() })
ipcMain.handle('tab:close-current', (event) => { if (requirePanel(event)) closeTab(activeTabId) })
ipcMain.handle('tab:refresh-interval', (event, seconds) => { if (requirePanel(event)) setRefreshInterval(activeTabId, seconds) })
ipcMain.handle('tab:zoom', (event, delta) => { if (requirePanel(event) && [-0.5, 0.5].includes(delta)) adjustZoom(delta) })
ipcMain.handle('tab:zoom-reset', (event) => { if (requirePanel(event)) resetZoom() })
ipcMain.handle('tab:back', (event) => { if (requirePanel(event) && activeView?.webContents.navigationHistory.canGoBack()) activeView.webContents.navigationHistory.goBack() })
ipcMain.handle('tab:forward', (event) => { if (requirePanel(event) && activeView?.webContents.navigationHistory.canGoForward()) activeView.webContents.navigationHistory.goForward() })
ipcMain.handle('tab:reload', (event) => { if (requirePanel(event)) activeView?.webContents.reload() })
ipcMain.handle('window:toggle-pin', (event) => { if (requirePanel(event)) { pinned = !pinned; window.setAlwaysOnTop(pinned, 'screen-saver'); sendState() } })
ipcMain.handle('window:hide', (event) => { if (requirePanel(event)) window.hide() })
ipcMain.handle('window:toggle-size', (event) => { if (requirePanel(event)) toggleWindowSize() })
ipcMain.handle('window:toggle-screen-fill', (event) => { if (requirePanel(event)) toggleScreenFill() })
ipcMain.handle('window:preset-save', (event, index, name) => (requirePanel(event) || requireSettingsWindow(event)) && saveWindowPreset(index, name) ? ({ settings: publicSettings() }) : ({ error: 'Could not save this window position.' }))
ipcMain.handle('window:preset-restore', (event, index) => (requirePanel(event) || requireSettingsWindow(event)) ? restoreWindowPreset(index) : false)
ipcMain.handle('window:preset-reset', (event) => (requirePanel(event) || requireSettingsWindow(event)) ? ({ settings: resetWindowPresets() }) : null)
ipcMain.handle('media:choose-video', (event) => event.sender.id === mediaWindow?.webContents.id ? chooseLocalVideo(mediaWindow) : null)
ipcMain.handle('media:set-volume', (event, volume) => {
  if (event.sender.id !== mediaWindow?.webContents.id || !Number.isFinite(volume)) return null
  setMediaVolume(volume)
  return { volume: settings.mediaVolume, muted: settings.mediaMuted }
})
ipcMain.handle('media:toggle-mute', (event) => {
  if (event.sender.id !== mediaWindow?.webContents.id) return null
  toggleMediaMute()
  return { volume: settings.mediaVolume, muted: settings.mediaMuted }
})
ipcMain.on('media:save-position', (event, filePath, time) => { if (event.sender.id === mediaWindow?.webContents.id) saveMediaPosition(filePath, time) })
ipcMain.on('media:save-position-sync', (event, filePath, time) => { if (event.sender.id === mediaWindow?.webContents.id) saveMediaPosition(filePath, time) })
ipcMain.on('media:playing', (event, playing) => { if (event.sender.id === mediaWindow?.webContents.id) setMediaPlaying(Boolean(playing)) })
ipcMain.handle('bookmark:add', (event) => {
  if (!requirePanel(event)) return
  const tab = activeTab()
  if (!tab.url || bookmarkItems.some((item) => item.url === tab.url)) return
  bookmarkItems.push({ title: tab.title || safeHost(tab.url), url: tab.url, icon: (tab.title || safeHost(tab.url)).trim().slice(0, 1).toUpperCase(), folder: '' })
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
  const folder = String(input.folder || '').replace(/[\r\n\0]/g, '').trim().slice(0, 40)
  const item = { title, url, icon, folder }
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
ipcMain.handle('history:state', (event) => requireHistory(event) ? publishHistory() : [])
ipcMain.handle('history:open', (event) => { if (!requirePanel(event)) return false; showHistoryWindow(); return true })
ipcMain.handle('history:action', (event, id, action) => {
  if (!requireHistory(event)) return { error: 'Not allowed.' }
  if (action === 'clear') { historyEntries = []; saveSoon(); publishHistory(); return { ok: true } }
  const index = historyEntries.findIndex((entry) => entry.id === id)
  if (index < 0) return { error: 'History entry not found.' }
  if (action === 'remove') { historyEntries.splice(index, 1); saveSoon(); publishHistory(); return { ok: true } }
  if (action === 'open' || action === 'open-new-tab') {
    const url = normalizeStoredUrl(historyEntries[index].url)
    if (!url) return { error: 'This address can no longer be opened safely.' }
    showBrowserWorkspace()
    if (action === 'open-new-tab') {
      const tabId = createNewTab(url)
      if (typeof tabId !== 'string') return { error: tabId?.error || 'Could not open a new tab.' }
    } else {
      const result = navigate(url)
      if (result?.error) return result
    }
    window?.show(); window?.focus()
    return { ok: true }
  }
  return { error: 'Unknown history action.' }
})
ipcMain.handle('notes:state', (event) => requireNotes(event) ? publishNotes() : [])
ipcMain.handle('notes:ocr-image', (event, imageDataUrl) => requireNotes(event) ? recognizeNoteImage(imageDataUrl) : { error: 'Notes is not open.' })
ipcMain.handle('notes:create', (event, sourceId) => {
  if (!requireNotes(event)) return null
  const source = notes.find((note) => note.id === sourceId)
  return createNote(source || null)
})
ipcMain.handle('notes:update', (event, id, input = {}) => {
  if (!requireNotes(event)) return null
  return updateNoteData(id, input)
})
ipcMain.on('notes:save-sync', (event, id, input = {}) => { if (requireNotesSave(event)) event.returnValue = Boolean(updateNoteData(id, input)) })
ipcMain.handle('notes:delete', (event, id) => {
  if (!requireNotes(event)) return null
  notes = notes.filter((note) => note.id !== id)
  if (!notes.length) createNote()
  saveSoon()
  return publishNotes()
})
ipcMain.handle('reader:state', (event) => requireReader(event) ? publishReaderState() : [])
ipcMain.handle('reader:import', (event) => requireReader(event) ? importReaderDocument() : null)
ipcMain.handle('reader:load', (event, id) => {
  if (!requireReader(event)) return null
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return null
  try {
    const stat = fs.statSync(doc.path)
    if (!stat.isFile() || stat.size > 200 * 1024 * 1024) return { error: 'This document is missing or larger than 200 MB.' }
    return { document: publicReaderDocuments().find((item) => item.id === id), data: new Uint8Array(fs.readFileSync(doc.path)) }
  } catch { return { error: 'This document is missing. Remove it from the library and import it again.' } }
})
ipcMain.handle('reader:save-location', (event, id, state) => requireReader(event) ? saveReaderLocation(id, state) : false)
ipcMain.handle('reader:add-bookmark', (event, id, state) => requireReader(event) ? addReaderBookmark(id, state) : null)
ipcMain.handle('reader:add-highlight', (event, id, input) => requireReader(event) ? saveReaderHighlight(id, input) : null)
ipcMain.handle('reader:remove-bookmark', (event, id, bookmarkId) => {
  if (!requireReader(event)) return false
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return false
  doc.bookmarks = doc.bookmarks.filter((item) => item.id !== bookmarkId)
  saveSoon(); publishReaderState(); return true
})
ipcMain.handle('reader:remove-highlight', (event, id, highlightId) => {
  if (!requireReader(event)) return false
  const doc = readerDocuments.find((item) => item.id === id)
  if (!doc) return false
  doc.highlights = doc.highlights.filter((item) => item.id !== highlightId)
  saveSoon(); publishReaderState(); return true
})
ipcMain.handle('reader:remove-document', (event, id) => {
  if (!requireReader(event)) return false
  const index = readerDocuments.findIndex((item) => item.id === id)
  if (index < 0) return false
  const [doc] = readerDocuments.splice(index, 1)
  const library = path.join(app.getPath('userData'), 'Reader Library')
  if (path.dirname(doc.path) === library) { try { fs.unlinkSync(doc.path) } catch { /* the library record can still be removed */ } }
  saveSoon(); publishReaderState(); return true
})
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
  registeredGlobalShortcuts.clear()
  for (const [id, item] of liveDownloads) {
    const record = downloadRecords.find((entry) => entry.id === id)
    if (record && !item.isDone()) downloadSnapshot(item, record)
  }
  for (const timer of refreshTimers.values()) clearInterval(timer)
  refreshTimers.clear()
  for (const timer of idleDiscardTimers.values()) clearTimeout(timer)
  idleDiscardTimers.clear()
  if (mediaPowerSaveId) powerSaveBlocker.stop(mediaPowerSaveId)
  mediaPowerSaveId = 0
  flushStore()
})
app.on('before-quit', (event) => {
  isQuitting = true
  if (!notesOcrWorkerPromise || notesOcrShutdownInProgress) return
  event.preventDefault()
  notesOcrShutdownInProgress = true
  void notesOcrWorkerPromise.then((worker) => worker.terminate()).catch(() => {}).finally(() => app.quit())
})
app.on('window-all-closed', (event) => { if (!isQuitting) event.preventDefault() })
