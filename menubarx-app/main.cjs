const { app, BrowserWindow, WebContentsView, Menu, nativeImage, nativeTheme, screen, globalShortcut, ipcMain, shell, session, clipboard, dialog, systemPreferences, powerSaveBlocker, desktopCapturer } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const readline = require('node:readline')
const { pathToFileURL } = require('node:url')
const { createWorker } = require('tesseract.js')
const englishOcrData = require('@tesseract.js-data/eng')
const koreanOcrData = require('@tesseract.js-data/kor')

const userDataOverride = process.env.FLOA_USER_DATA_DIR || app.commandLine.getSwitchValue('user-data-dir')
const existingUserDataPath = userDataOverride || path.join(app.getPath('appData'), 'Just Browse')
app.setName('Floa')
app.setPath('userData', existingUserDataPath)
if (process.platform === 'win32') app.setAppUserModelId('com.justchat.justbrowse')

const PANEL_WIDTH = 660
const PANEL_HEIGHT = 570
const TOOLBAR_HEIGHT = 116
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
  { id: 'openNotes', label: 'Open Notes', default: 'Alt+Command+N', global: true },
  { id: 'cycleWorkspace', label: 'Switch between Browser, Mirror, and Notes', default: 'Alt+Command+S', global: true },
  { id: 'nextTabGlobal', label: 'Select next browser tab from any app', default: 'Alt+Command+Tab', global: true },
  { id: 'previousTabGlobal', label: 'Select previous browser tab from any app', default: 'Alt+Shift+Command+Tab', global: true },
  { id: 'quitApp', label: 'Quit Floa', default: 'Alt+Command+X', global: true },
  { id: 'focusAddressGlobal', label: 'Focus address bar from Floa', default: 'Alt+Command+U' },
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
  { id: 'openWindowMirror', label: 'Open Window Mirror', default: 'Alt+Command+W', global: true },
  { id: 'readerOpen', label: 'Import a book or document', default: 'CommandOrControl+O', readerOnly: true },
  { id: 'readerSearch', label: 'Find in book', default: 'CommandOrControl+F', readerOnly: true },
  { id: 'readerPrevious', label: 'Previous page', default: 'CommandOrControl+PageUp', readerOnly: true },
  { id: 'readerNext', label: 'Next page', default: 'CommandOrControl+PageDown', readerOnly: true },
  { id: 'readerZoomIn', label: 'Increase reading size', default: 'CommandOrControl+Plus', readerOnly: true },
  { id: 'readerZoomOut', label: 'Decrease reading size', default: 'CommandOrControl+-', readerOnly: true },
  { id: 'readerZoomReset', label: 'Reset reading size', default: 'CommandOrControl+0', readerOnly: true },
  { id: 'readerBookmark', label: 'Bookmark reading position', default: 'CommandOrControl+D', readerOnly: true },
  { id: 'mirrorNewTab', label: 'Add a mirrored window', default: 'CommandOrControl+T', mirrorOnly: true },
  { id: 'mirrorCloseTab', label: 'Stop active mirror tab', default: 'CommandOrControl+W', mirrorOnly: true },
  { id: 'mirrorNextTab', label: 'Next mirror tab', default: 'CommandOrControl+PageDown', mirrorOnly: true },
  { id: 'mirrorPreviousTab', label: 'Previous mirror tab', default: 'CommandOrControl+PageUp', mirrorOnly: true },
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
  { id: 'downloads', label: 'Open downloads', default: 'CommandOrControl+Shift+J' },
  { id: 'history', label: 'Open browsing history', default: 'CommandOrControl+Y' }
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
const MAX_TAB_CHOICES = [0, 5, 10, 15, 20, 30]
const TAB_DISCARD_CHOICES = [0, 5, 10, 30]
const DEFAULT_SETTINGS = {
  searchEngine: 'google', homepage: '', userAgentProfile: 'default', userAgentCustom: '',
  defaultRefreshSeconds: 0, defaultZoomLevel: 0, downloadDirectory: '',
  shortcuts: DEFAULT_SHORTCUTS, panelShortcut: 'Alt+G', globalShortcutsEnabled: true, restoreTabs: true, closeOnBlur: false, presentation: 'window', followSpaces: true, opacity: 1,
  defaultViewportProfile: 'desktop', maxTabs: 15, discardIdleMinutes: 10, mediaVolume: 1, mediaMuted: false,
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
const emulatedViews = new WeakSet()
const detachedWindows = new Map()
const websiteAppWindows = new Set()
const idleDiscardTimers = new Map()
const registeredGlobalShortcuts = new Map()
let pinned = false
let cleanMode = false
let clickThrough = false
let findBarOpen = false
let appMuteEnabled = false
let workspaceMode = 'browser'
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
let notesWindow
let notes = []
let notesOcrWorkerPromise
let notesOcrShutdownInProgress = false
let readerWindow
let readerDocuments = []
let mirrorWindow
let mirrorSources = new Map()
let allowedMirrorSourceIds = new Set()
const interactiveMirrorSourceIds = new Set()
const heldMirrorButtons = new Map()
const heldMirrorKeys = new Map()
let activeMirrorSourceId = ''
let mirrorInputProcess
let mirrorInputLines
let mirrorInputRequestId = 0
const mirrorInputPending = new Map()
let mirrorInteractionQueue = Promise.resolve()
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
  const shortcuts = Object.fromEntries(SHORTCUT_DEFINITIONS.map((definition) => {
    const legacyValue = definition.id === 'togglePanel' ? savedSettings.panelShortcut : undefined
    let savedValue = savedSettings.shortcuts?.[definition.id] ?? legacyValue ?? definition.default
    if (definition.id === 'newTab' && savedValue === 'CommandOrControl+N') savedValue = definition.default
    if (definition.id === 'togglePanel' && savedValue === 'Alt+X') savedValue = definition.default
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
    defaultViewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === savedSettings.defaultViewportProfile) ? savedSettings.defaultViewportProfile : 'desktop',
    maxTabs: MAX_TAB_CHOICES.includes(savedSettings.maxTabs) ? savedSettings.maxTabs : DEFAULT_SETTINGS.maxTabs,
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
  tabs = tabs.filter((tab) => tab && typeof tab.id === 'string').slice(0, 30).map((tab) => ({
    id: tab.id,
    url: normalizeStoredUrl(tab.url),
    title: typeof tab.title === 'string' ? tab.title.slice(0, 300) : safeHost(tab.url || ''),
    refreshSeconds: REFRESH_INTERVALS.includes(tab.refreshSeconds) ? tab.refreshSeconds : settings.defaultRefreshSeconds,
    zoomLevel: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].includes(tab.zoomLevel) ? tab.zoomLevel : settings.defaultZoomLevel,
    userAgentProfile: USER_AGENT_PROFILES.some((profile) => profile.id === tab.userAgentProfile) ? tab.userAgentProfile : settings.userAgentProfile,
    userAgentCustom: typeof tab.userAgentCustom === 'string' ? tab.userAgentCustom.slice(0, 512) : '',
    viewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === tab.viewportProfile) ? tab.viewportProfile : settings.defaultViewportProfile,
    detachedBounds: normalizeDetachedBounds(tab.detachedBounds),
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
  return { id: crypto.randomUUID(), url, title: url ? safeHost(url) : 'New Tab', refreshSeconds: settings.defaultRefreshSeconds, zoomLevel: settings.defaultZoomLevel, userAgentProfile: settings.userAgentProfile, userAgentCustom: '', viewportProfile: settings.defaultViewportProfile, detachedBounds: null, discarded: false, muted: false }
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
    const isNotesWindow = Boolean(notesWindow && !notesWindow.isDestroyed() && contents.id === notesWindow.webContents.id)
    const isReaderWindow = Boolean(readerWindow && !readerWindow.isDestroyed() && contents.id === readerWindow.webContents.id)
    const isMirrorWindow = Boolean(mirrorWindow && !mirrorWindow.isDestroyed() && contents.id === mirrorWindow.webContents.id)
    if (mainPage === 'settings' && !isNotesWindow && !isReaderWindow && !isMirrorWindow) return
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
    const definition = SHORTCUT_DEFINITIONS.find((item) => Boolean(item.noteOnly) === isNotesWindow && Boolean(item.readerOnly) === isReaderWindow && Boolean(item.mirrorOnly) === isMirrorWindow && shortcutMatches(input, settings.shortcuts[item.id]))
    if (!definition) return
    if (mainPage === 'settings' && !isNotesWindow && !isReaderWindow && !isMirrorWindow && !['togglePanel', 'hideWindow', 'settings', 'shortcutsSettings'].includes(definition.id)) return
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
    case 'followSpaces': settings.followSpaces = !settings.followSpaces; applySpaceVisibility(); saveSoon(); sendState(); break
    case 'opacityDown': changeOpacity(-0.05); break
    case 'opacityUp': changeOpacity(0.05); break
    case 'cleanMode': if (mainPage === 'browser') { cleanMode = !cleanMode; updateBounds(); sendState() } break
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
    case 'openNotes': showNotesWindow(); break
    case 'cycleWorkspace': cycleWorkspace(); break
    case 'nextTabGlobal': showBrowserWorkspace(); runShortcut('nextTab'); break
    case 'previousTabGlobal': showBrowserWorkspace(); runShortcut('previousTab'); break
    case 'quitApp': app.quit(); break
    case 'focusAddressGlobal': case 'focusAddress':
      showBrowserWorkspace()
      activeView?.webContents.blur()
      window?.webContents.focus()
      void window?.webContents.executeJavaScript("document.querySelector('#address')?.focus(); document.querySelector('#address')?.select()")
      break
    case 'shortcutsSettings': showSettingsPage(true); break
    case 'noteNew': case 'noteNewAlternate': notesWindow?.webContents.send('notes:command', 'new'); break
    case 'noteDuplicate': notesWindow?.webContents.send('notes:command', 'duplicate'); break
    case 'noteSave': case 'noteSaveAlternate': notesWindow?.webContents.send('notes:command', 'save'); break
    case 'noteBold': notesWindow?.webContents.send('notes:command', 'bold'); break
    case 'noteItalic': notesWindow?.webContents.send('notes:command', 'italic'); break
    case 'noteUnderline': notesWindow?.webContents.send('notes:command', 'underline'); break
    case 'openReader': showReaderWindow(); break
    case 'readerOpen': readerWindow?.webContents.send('reader:command', 'open'); break
    case 'readerSearch': readerWindow?.webContents.send('reader:command', 'search'); break
    case 'readerPrevious': readerWindow?.webContents.send('reader:command', 'previous'); break
    case 'readerNext': readerWindow?.webContents.send('reader:command', 'next'); break
    case 'readerZoomIn': readerWindow?.webContents.send('reader:command', 'zoom-in'); break
    case 'readerZoomOut': readerWindow?.webContents.send('reader:command', 'zoom-out'); break
    case 'readerZoomReset': readerWindow?.webContents.send('reader:command', 'zoom-reset'); break
    case 'readerBookmark': readerWindow?.webContents.send('reader:command', 'bookmark'); break
    case 'openWindowMirror': showMirrorWindow(); break
    case 'mirrorNewTab': mirrorWindow?.webContents.send('mirror:command', 'new'); break
    case 'mirrorCloseTab': mirrorWindow?.webContents.send('mirror:command', 'close'); break
    case 'mirrorNextTab': mirrorWindow?.webContents.send('mirror:command', 'next'); break
    case 'mirrorPreviousTab': mirrorWindow?.webContents.send('mirror:command', 'previous'); break
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
  workspaceMode = 'notes'
  if (!notes.length) createNote()
  if (notesWindow && !notesWindow.isDestroyed()) { notesWindow.show(); notesWindow.focus(); return }
  notesWindow = new BrowserWindow({ width: 860, height: 640, minWidth: 620, minHeight: 420, show: false, title: 'Floa Notes', alwaysOnTop: true, backgroundColor: chromeCanvasColor(), webPreferences: { preload: path.join(__dirname, 'notes-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  notesWindow.setAlwaysOnTop(true, 'screen-saver')
  notesWindow.setVisibleOnAllWorkspaces(Boolean(settings.followSpaces), { visibleOnFullScreen: Boolean(settings.followSpaces) })
  installKeyboardShortcuts(notesWindow.webContents)
  notesWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  notesWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  void notesWindow.loadFile(path.join(__dirname, 'notes.html'))
  notesWindow.once('ready-to-show', () => { if (!notesWindow.isDestroyed()) { notesWindow.show(); notesWindow.focus() } })
  notesWindow.on('closed', () => { notesWindow = undefined })
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
  if (notesWindow && !notesWindow.isDestroyed()) notesWindow.webContents.send('notes:state', ordered)
  return ordered
}

function publicReaderDocuments() {
  return readerDocuments.map(({ id, title, type, lastLocation, lastPage, zoom, mode, bookmarks, highlights, updatedAt }) => ({ id, title, type, lastLocation, lastPage, zoom, mode, bookmarks, highlights, updatedAt }))
}

function publishReaderState() {
  const state = publicReaderDocuments()
  if (readerWindow && !readerWindow.isDestroyed()) readerWindow.webContents.send('reader:state', state)
  return state
}

function showReaderWindow() {
  if (readerWindow && !readerWindow.isDestroyed()) { readerWindow.show(); readerWindow.focus(); publishReaderState(); return }
  readerWindow = new BrowserWindow({ width: 980, height: 720, minWidth: 640, minHeight: 460, show: false, title: 'Floa Reader', alwaysOnTop: true, backgroundColor: chromeCanvasColor(), webPreferences: { preload: path.join(__dirname, 'reader-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  readerWindow.setAlwaysOnTop(true, 'screen-saver')
  readerWindow.setVisibleOnAllWorkspaces(Boolean(settings.followSpaces), { visibleOnFullScreen: Boolean(settings.followSpaces) })
  installKeyboardShortcuts(readerWindow.webContents)
  readerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  readerWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  void readerWindow.loadFile(path.join(__dirname, 'reader.html'))
  readerWindow.once('ready-to-show', () => { if (!readerWindow.isDestroyed()) { readerWindow.show(); readerWindow.focus(); publishReaderState() } })
  readerWindow.on('closed', () => { readerWindow = undefined })
}

function showMirrorWindow() {
  workspaceMode = 'mirror'
  if (mirrorWindow && !mirrorWindow.isDestroyed()) { mirrorWindow.show(); mirrorWindow.focus(); return }
  mirrorWindow = new BrowserWindow({ width: 760, height: 560, minWidth: 480, minHeight: 340, show: false, title: 'Floa · Window Mirror', alwaysOnTop: true, backgroundColor: chromeCanvasColor(), webPreferences: { partition: SESSION_PARTITION, preload: path.join(__dirname, 'mirror-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mirrorWindow.setAlwaysOnTop(true, 'screen-saver')
  mirrorWindow.setVisibleOnAllWorkspaces(Boolean(settings.followSpaces), { visibleOnFullScreen: Boolean(settings.followSpaces) })
  installKeyboardShortcuts(mirrorWindow.webContents)
  mirrorWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mirrorWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  void mirrorWindow.loadFile(path.join(__dirname, 'mirror.html'))
  mirrorWindow.once('ready-to-show', () => { if (mirrorWindow && !mirrorWindow.isDestroyed()) { mirrorWindow.show(); mirrorWindow.focus() } })
  mirrorWindow.on('closed', () => {
    void serializeMirrorInteraction(async () => {
      for (const sourceId of heldMirrorInputSources()) await releaseMirrorInput(sourceId)
      mirrorWindow = undefined; mirrorSources.clear(); allowedMirrorSourceIds.clear(); interactiveMirrorSourceIds.clear(); activeMirrorSourceId = ''
      mirrorInputProcess?.kill(); stopMirrorInputHelper()
    })
  })
}

async function listMirrorSources() {
  if (!mirrorWindow || mirrorWindow.isDestroyed()) return { error: 'Window Mirror is closed.' }
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen')
    if (status === 'denied' || status === 'restricted') return { error: 'screen-permission', status }
  }
  try {
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 360, height: 220 }, fetchWindowIcons: true })
    mirrorSources = new Map(sources
      .filter((source) => {
        const windowId = Number(/^window:(\d+):/.exec(source.id)?.[1])
        const isOwnWindow = Number.isFinite(windowId) && Boolean(BrowserWindow.fromId(windowId))
        return !isOwnWindow && source.name?.trim() && !/floa(?: reader| notes| · window mirror)?/i.test(source.name)
      })
      .map((source) => [source.id, source]))
    if (!mirrorSources.size && process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted') return { error: 'screen-permission', status: systemPreferences.getMediaAccessStatus('screen') }
    return [...mirrorSources.values()].map((source) => ({ id: source.id, name: source.name.slice(0, 200), thumbnail: source.thumbnail.toDataURL(), icon: source.appIcon?.toDataURL() || '' })).sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted') return { error: 'screen-permission', status: systemPreferences.getMediaAccessStatus('screen') }
    return { error: error?.message || 'Could not list open windows.' }
  }
}

function stopMirrorInputHelper(error = new Error('Mirror input helper stopped.')) {
  mirrorInputLines?.close()
  mirrorInputLines = undefined
  mirrorInputProcess = undefined
  for (const pending of mirrorInputPending.values()) {
    clearTimeout(pending.timer)
    pending.resolve({ ok: false, error: error.message })
  }
  mirrorInputPending.clear()
}

function startMirrorInputHelper() {
  if (process.platform !== 'darwin') return { error: 'Window interaction is available on macOS only.' }
  if (mirrorInputProcess && !mirrorInputProcess.killed) return null
  const helperPath = app.isPackaged
    ? path.resolve(process.resourcesPath, '..', 'Helpers', 'FloaMirrorInput')
    : path.resolve(__dirname, '../out/FloaMirrorInput')
  if (!fs.existsSync(helperPath)) return { error: 'The native Window Mirror input helper is not built.' }
  try {
    const child = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'ignore'] })
    mirrorInputProcess = child
    mirrorInputLines = readline.createInterface({ input: child.stdout })
    mirrorInputLines.on('line', (line) => {
      let response
      try { response = JSON.parse(line) } catch { return }
      const pending = mirrorInputPending.get(String(response.id))
      if (!pending) return
      mirrorInputPending.delete(String(response.id))
      clearTimeout(pending.timer)
      pending.resolve(response)
    })
    child.once('error', (error) => stopMirrorInputHelper(error))
    child.once('exit', (code) => stopMirrorInputHelper(new Error(`Mirror input helper exited (${code ?? 'unknown'}).`)))
    child.stdin.on('error', (error) => stopMirrorInputHelper(error))
    return null
  } catch (error) { return { error: error.message || 'Could not start the native Window Mirror helper.' } }
}

function requestMirrorInput(request) {
  const startupError = startMirrorInputHelper()
  if (startupError) return Promise.resolve({ ok: false, ...startupError })
  const id = String(++mirrorInputRequestId)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      mirrorInputPending.delete(id)
      resolve({ ok: false, error: 'The native Window Mirror helper did not respond.' })
    }, 4000)
    mirrorInputPending.set(id, { resolve, timer })
    try { mirrorInputProcess.stdin.write(`${JSON.stringify({ ...request, id })}\n`) }
    catch (error) {
      mirrorInputPending.delete(id); clearTimeout(timer)
      resolve({ ok: false, error: error.message || 'Could not send input to the selected window.' })
    }
  })
}

function authorizedMirrorSource(event, sourceId) {
  return event.sender.id === mirrorWindow?.webContents.id && typeof sourceId === 'string'
    && allowedMirrorSourceIds.has(sourceId) && mirrorSources.has(sourceId)
}

function nativeMirrorWindowId(sourceId) {
  const match = /^window:(\d+):/.exec(sourceId)
  return match ? Number(match[1]) : 0
}

async function sendMirrorWindowAction(sourceId, action, input = {}) {
  const windowId = nativeMirrorWindowId(sourceId)
  if (!windowId) return { ok: false, error: 'This mirrored source does not expose a window identifier.' }
  return requestMirrorInput({ ...input, action, windowId })
}

function heldMirrorInputSources() {
  return new Set([...heldMirrorButtons.keys(), ...heldMirrorKeys.keys()])
}

function serializeMirrorInteraction(operation) {
  const pending = mirrorInteractionQueue.then(operation, operation)
  mirrorInteractionQueue = pending.then(() => undefined, () => undefined)
  return pending
}

async function releaseMirrorInput(sourceId) {
  const held = heldMirrorButtons.get(sourceId)
  heldMirrorButtons.delete(sourceId)
  const keys = heldMirrorKeys.get(sourceId)
  heldMirrorKeys.delete(sourceId)
  const windowId = nativeMirrorWindowId(sourceId)
  if (!windowId) return
  if (held) {
    for (const button of held.buttons) {
      await requestMirrorInput({ action: button === 'right' ? 'rightUp' : 'up', windowId, x: held.x, y: held.y })
    }
  }
  if (keys) {
    for (const [keyCode, flags] of [...keys.entries()].reverse()) {
      await requestMirrorInput({ action: 'keyUp', windowId, keyCode, flags })
    }
  }
}

async function importReaderDocument() {
  const result = await dialog.showOpenDialog(readerWindow, { title: 'Import Book or Document', properties: ['openFile'], filters: [{ name: 'Books and documents', extensions: ['pdf', 'epub', 'txt', 'md', 'markdown', 'rtf', 'html', 'htm'] }] })
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

function canMirrorCapture(contents, details = {}) {
  const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : []
  return Boolean(
    contents &&
    mirrorWindow && !mirrorWindow.isDestroyed() &&
    contents.id === mirrorWindow.webContents.id &&
    allowedMirrorSourceIds.size > 0 &&
    mediaTypes.includes('video') &&
    !mediaTypes.includes('audio')
  )
}

function configureSitePermissions(browserSession) {
  browserSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details = {}) => {
    if (permission === 'display-capture') return canMirrorCapture(contents, details)
    const permissions = permissionKinds(permission, details)
    const origin = safePermissionOrigin(requestingOrigin)
    if (!origin || (contents && (contents.isDestroyed() || origin !== safePermissionOrigin(contents.getURL())))) return false
    if (!permissions.length && permission === 'media') return ['camera', 'microphone'].some((item) => sitePermissions[origin]?.includes(item))
    if (!permissions.length) return false
    return permissions.every((item) => sitePermissions[origin]?.includes(item))
  })
  browserSession.setPermissionRequestHandler((contents, permission, callback, details = {}) => {
    if (permission === 'display-capture') {
      callback(canMirrorCapture(contents, details))
      return
    }
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
    settings: publicSettings(),
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
  const toolbarOffset = cleanMode ? 0 : TOOLBAR_HEIGHT
  activeView.setBounds({ x: 0, y: toolbarOffset, width, height: Math.max(0, height - toolbarOffset) })
  applyViewportProfile(activeView, activeTab(), width, Math.max(0, height - toolbarOffset))
}

function applyViewportProfile(view, record, availableWidth = PANEL_WIDTH, availableHeight = PANEL_HEIGHT - TOOLBAR_HEIGHT) {
  if (!view || view.webContents.isDestroyed()) return
  const profile = VIEWPORT_PROFILES.find((item) => item.id === record?.viewportProfile) || VIEWPORT_PROFILES[0]
  if (!profile.width) {
    if (emulatedViews.has(view)) {
      view.webContents.disableDeviceEmulation()
      emulatedViews.delete(view)
    }
    return
  }
  const scale = Math.min(1, availableWidth / profile.width, availableHeight / profile.height)
  view.webContents.enableDeviceEmulation({
    screenPosition: 'mobile', screenSize: { width: profile.width, height: profile.height },
    viewPosition: { x: 0, y: 0 }, viewSize: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.scale, scale
  })
  emulatedViews.add(view)
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
  const tabLimit = settings.maxTabs || Number.POSITIVE_INFINITY
  if (tabs.length >= tabLimit) {
    const message = `You have reached the ${tabLimit}-tab limit.`
    if (window && !window.isDestroyed()) window.webContents.send('app:download-status', message)
    return { error: message }
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
  view.setBackgroundColor(chromeCanvasColor())
  const contents = view.webContents
  let currentHistoryId = ''
  let skipRestoredVisit = restoredTabIds.delete(record.id)
  contents.setAudioMuted(appMuteEnabled || Boolean(record.muted))
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
  const record = tabs.find((tab) => tab.id === id)
  if (record && !detachedWindow.isDestroyed()) record.detachedBounds = normalizeDetachedBounds(detachedWindow.getNormalBounds())
  saveSoon()
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

  const savedBounds = record.detachedBounds
  const restoredBounds = savedBounds ? boundsWithinWorkArea(savedBounds, savedBounds.width, savedBounds.height) : null
  const detachedWindow = new BrowserWindow({
    ...(restoredBounds || { width: PANEL_WIDTH, height: PANEL_HEIGHT }), minWidth: 420, minHeight: 320,
    show: false, title: record.title || safeHost(record.url), backgroundColor: '#fff',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  installKeyboardShortcuts(detachedWindow.webContents)
  detachedWindow.contentView.addChildView(view)
  const updateDetachedBounds = () => {
    if (detachedWindow.isDestroyed() || view.webContents.isDestroyed()) return
    record.detachedBounds = normalizeDetachedBounds(detachedWindow.getNormalBounds())
    const [width, height] = detachedWindow.getContentSize()
    view.setBounds({ x: 0, y: 0, width, height })
    saveSoon()
  }
  detachedWindow.on('resize', updateDetachedBounds)
  detachedWindow.on('move', updateDetachedBounds)
  detachedWindow.on('close', (event) => {
    if (record) record.detachedBounds = normalizeDetachedBounds(detachedWindow.getNormalBounds())
    saveSoon()
    if (!detachedWindow._menuBrowserClosing && !isQuitting) { event.preventDefault(); reattachTab(record.id) }
  })
  view.webContents.on('page-title-updated', (_event, title) => {
    if (!detachedWindow.isDestroyed()) detachedWindow.setTitle(title || record.title || safeHost(record.url))
  })
  detachedWindows.set(record.id, detachedWindow)
  updateDetachedBounds()
  detachedWindow.show()
  detachedWindow.focus()

  let replacement = tabs.find((tab) => tab.id !== record.id && !detachedWindows.has(tab.id))
  if (!replacement && (settings.maxTabs === 0 || tabs.length < settings.maxTabs)) { replacement = newTabRecord(); tabs.push(replacement) }
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
  for (const appWindow of websiteAppWindows) {
    if (!appWindow.isDestroyed()) appWindow.webContents.setAudioMuted(appMuteEnabled)
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
    { label: 'Window Mirror…', accelerator: settings.shortcuts.openWindowMirror || undefined, click: showMirrorWindow },
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
  mainPage = 'settings'
  if (activeView && !activeView.webContents.isDestroyed()) {
    activeView.setVisible(false)
    try { window.contentView.removeChildView(activeView) } catch { /* view was already detached */ }
  }
  void window.loadFile(path.join(__dirname, 'settings.html')).then(() => { if (window && !window.isDestroyed()) { window.focus(); if (focusShortcuts) focusShortcutList() } })
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
    window.setTitle('Floa')
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

function registerPanelShortcut(shortcut, allowFallback = false) {
  if (panelShortcut) unregisterGlobalShortcut(panelShortcut)
  if (tryRegisterGlobalShortcut(shortcut, showPanel, 'togglePanel')) {
    panelShortcut = shortcut
    console.info(`[Floa] Registered global shortcut: ${shortcut}`)
    const fallback = 'CommandOrControl+Shift+Space'
    const fallbackRegistered = allowFallback && shortcut !== fallback && tryRegisterGlobalShortcut(fallback, showPanel, 'togglePanel')
    if (fallbackRegistered) console.info(`[Floa] Registered backup global shortcut: ${fallback}`)
    return true
  }
  console.error(`[Floa] Could not register global shortcut: ${shortcut}`)
  const fallback = 'CommandOrControl+Shift+Space'
  if (allowFallback && shortcut !== fallback && tryRegisterGlobalShortcut(fallback, showPanel, 'togglePanel')) {
    panelShortcut = fallback
    settings.shortcuts.togglePanel = fallback
    settings.panelShortcut = fallback
    saveSoon()
    console.warn(`[Floa] Using fallback global shortcut: ${fallback}`)
    return true
  }
  if (panelShortcut) tryRegisterGlobalShortcut(panelShortcut, showPanel, 'togglePanel')
  return false
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
  if (notesWindow && !notesWindow.isDestroyed()) notesWindow.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: visible })
  if (readerWindow && !readerWindow.isDestroyed()) readerWindow.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: visible })
  if (mirrorWindow && !mirrorWindow.isDestroyed()) mirrorWindow.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: visible })
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
  if (!window.isVisible()) showPanel()
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

function registerActionShortcut(id, shortcut) {
  const previous = settings.shortcuts[id]
  if (previous) unregisterGlobalShortcut(previous)
  if (!shortcut) return true
  if (tryRegisterGlobalShortcut(shortcut, () => runShortcut(id), id)) {
    console.info(`[Floa] Registered global shortcut: ${shortcut}`)
    return true
  }
  console.error(`[Floa] Could not register global shortcut: ${shortcut}`)
  if (previous) tryRegisterGlobalShortcut(previous, () => runShortcut(id), id)
  return false
}

function registerFollowSpacesShortcut(shortcut) {
  const previous = settings.shortcuts.followSpaces
  if (previous) unregisterGlobalShortcut(previous)
  if (!shortcut) {
    console.info('[Floa] Follow across Spaces shortcut disabled')
    return true
  }
  if (tryRegisterGlobalShortcut(shortcut, () => runShortcut('followSpaces'), 'followSpaces')) {
    console.info(`[Floa] Registered global shortcut: ${shortcut}`)
    return true
  }
  console.error(`[Floa] Could not register global shortcut: ${shortcut}`)
  if (previous) tryRegisterGlobalShortcut(previous, () => runShortcut('followSpaces'), 'followSpaces')
  return false
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
    const scope = definition.noteOnly ? 'notes' : definition.readerOnly ? 'reader' : definition.mirrorOnly ? 'mirror' : 'browser'
    const previous = [...assigned.values()].find((entry) => entry.accelerator === accelerator && (entry.scope === scope || entry.global || definition.global))
    if (previous) return { error: `“${definition.label}” conflicts with “${previous.label}”.` }
    assigned.set(`${scope}:${accelerator}`, { ...definition, scope, accelerator })
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
    mediaVolume: Number.isFinite(Number(input.mediaVolume)) ? Math.min(1, Math.max(0, Number(input.mediaVolume))) : settings.mediaVolume,
    mediaMuted: typeof input.mediaMuted === 'boolean' ? input.mediaMuted : settings.mediaMuted,
    defaultViewportProfile: VIEWPORT_PROFILES.some((profile) => profile.id === input.defaultViewportProfile) ? input.defaultViewportProfile : settings.defaultViewportProfile,
    maxTabs: MAX_TAB_CHOICES.includes(Number(input.maxTabs)) ? Number(input.maxTabs) : settings.maxTabs,
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
  const maxTabs = MAX_TAB_CHOICES.includes(Number(input.maxTabs)) ? Number(input.maxTabs) : settings.maxTabs
  if (maxTabs > 0 && maxTabs < tabs.length) return { error: `Close tabs until ${tabs.length} or fewer are open before lowering the tab limit.` }
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
  workspaceMode = 'browser'
  if (!window || window.isDestroyed()) createPanel()
  if (window.isVisible()) { window.hide(); return }
  const focusPanel = () => {
    suppressPanelBlurUntil = Date.now() + 700
    if (process.platform === 'darwin') app.focus({ steal: true })
    window.show()
    window.focus()
  }
  focusPanel()
  if (!activeView) activateTab(activeTabId)
  else updateBounds()
  if (activeView?.getVisible()) activeView.webContents.focus()
  else window.webContents.focus()
  sendState()
}

function showBrowserWorkspace() {
  workspaceMode = 'browser'
  if (!window || window.isDestroyed()) createPanel()
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  else if (mainPage === 'settings') closeSettingsPage()
  if (!window.isVisible()) window.show()
  if (process.platform === 'darwin') app.focus({ steal: true })
  window.focus()
  if (!activeView) activateTab(activeTabId)
  else updateBounds()
  if (activeView?.getVisible()) activeView.webContents.focus()
  else window.webContents.focus()
  sendState()
}

function cycleWorkspace() {
  const next = workspaceMode === 'browser' ? 'mirror' : workspaceMode === 'mirror' ? 'notes' : 'browser'
  if (next === 'mirror') showMirrorWindow()
  else if (next === 'notes') showNotesWindow()
  else showBrowserWorkspace()
}

function isScreenFilled() {
  if (!window || window.isDestroyed()) return false
  return settings.presentation === 'window' ? window.isFullScreen() : Boolean(panelScreenRestoreBounds)
}

function normalizeDetachedBounds(bounds) {
  if (!bounds || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key]))) return null
  if (Math.abs(bounds.x) > 100000 || Math.abs(bounds.y) > 100000 || bounds.width < 420 || bounds.width > 10000 || bounds.height < 320 || bounds.height > 10000) return null
  return { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) }
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
    width: normalWindow ? 1100 : PANEL_WIDTH, height: normalWindow ? 760 : PANEL_HEIGHT, show: false,
    title: 'Floa', frame: normalWindow, resizable: true,
    minWidth: normalWindow ? 640 : 420, minHeight: normalWindow ? 480 : 320,
    alwaysOnTop: true, skipTaskbar: false,
    backgroundColor: chromeCanvasColor(),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
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
    for (const [id, view] of views) if (!detachedWindows.has(id)) { disposeView(view); views.delete(id) }
    activeView = undefined
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
    previous._preserveViewsOnClose = true
    window = undefined
    previous.close()
  }
  if (process.platform === 'darwin') app.dock?.show()
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
function requireNotes(event) { return Boolean(notesWindow && !notesWindow.isDestroyed() && event.sender.id === notesWindow.webContents.id) }
function requireReader(event) { return Boolean(readerWindow && !readerWindow.isDestroyed() && event.sender.id === readerWindow.webContents.id) }
function requireHistory(event) { return Boolean(historyWindow && !historyWindow.isDestroyed() && event.sender.id === historyWindow.webContents.id) }
function requireSettingsWindow(event) {
  return Boolean((settingsWindow && !settingsWindow.isDestroyed() && event.sender.id === settingsWindow.webContents.id)
    || (mainPage === 'settings' && window && !window.isDestroyed() && event.sender.id === window.webContents.id))
}

app.whenReady().then(() => {
  loadStore()
  if (process.platform === 'darwin') {
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
  if (settings.globalShortcutsEnabled) {
    registerPanelShortcut(panelShortcut, true)
    registerFollowSpacesShortcut(settings.shortcuts.followSpaces)
    for (const definition of SHORTCUT_DEFINITIONS.filter((item) => item.global && !['togglePanel', 'followSpaces'].includes(item.id))) registerActionShortcut(definition.id, settings.shortcuts[definition.id])
  }
  activateTab(activeTabId)
  if (settings.presentation === 'window') { window.show(); window.focus() }
  for (const argument of process.argv.slice(1)) if (/^(justbrowse|menubrowser):\/\//.test(argument)) handleDeepLink(argument)
})

ipcMain.handle('app:state', (event) => requirePanel(event) ? ({ tabs: tabs.map((tab) => ({ ...tab, detached: detachedWindows.has(tab.id) })), bookmarks: bookmarkItems, searchEngine, settings: publicSettings(), activeTabId, pinned, cleanMode, clickThrough, opacity: settings.opacity, expanded: settings.presentation === 'panel' ? Boolean(expandedPanelRestoreBounds) : Boolean(window.isMaximized()), screenFilled: isScreenFilled(), muted: Boolean(activeView?.webContents.isAudioMuted()), canGoBack: Boolean(activeView?.webContents.navigationHistory.canGoBack()), canGoForward: Boolean(activeView?.webContents.navigationHistory.canGoForward()) }) : null)
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
ipcMain.handle('tab:detach', (event, id) => { if (requirePanel(event)) toggleTabDetachment(id) })
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
ipcMain.on('notes:save-sync', (event, id, input = {}) => { if (requireNotes(event)) event.returnValue = Boolean(updateNoteData(id, input)) })
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
ipcMain.handle('mirror:sources', (event) => event.sender.id === mirrorWindow?.webContents.id ? listMirrorSources() : { error: 'Not allowed.' })
ipcMain.handle('mirror:authorize-source', (event, sourceId) => serializeMirrorInteraction(() => {
  if (event.sender.id !== mirrorWindow?.webContents.id || typeof sourceId !== 'string' || !mirrorSources.has(sourceId)) return false
  allowedMirrorSourceIds.add(sourceId)
  return true
}))
ipcMain.handle('mirror:revoke-source', (event, sourceId) => serializeMirrorInteraction(async () => {
  if (event.sender.id !== mirrorWindow?.webContents.id || typeof sourceId !== 'string') return false
  await releaseMirrorInput(sourceId)
  allowedMirrorSourceIds.delete(sourceId)
  interactiveMirrorSourceIds.delete(sourceId)
  if (activeMirrorSourceId === sourceId) activeMirrorSourceId = ''
  return true
}))
ipcMain.handle('mirror:select-source', (event, sourceId) => serializeMirrorInteraction(async () => {
  if (!authorizedMirrorSource(event, sourceId)) return { ok: false, error: 'This window is not authorized for mirroring.' }
  const previousSourceId = activeMirrorSourceId
  if (activeMirrorSourceId !== sourceId) {
    if (activeMirrorSourceId) await releaseMirrorInput(activeMirrorSourceId)
    interactiveMirrorSourceIds.delete(activeMirrorSourceId)
    activeMirrorSourceId = sourceId
  }
  return { ok: true, previousSourceId }
}))
ipcMain.handle('mirror:accessibility', (event) => event.sender.id === mirrorWindow?.webContents.id
  ? requestMirrorInput({ action: 'accessibility' }) : { ok: false, error: 'Not allowed.' })
ipcMain.handle('mirror:set-interaction', (event, sourceId, enabled) => serializeMirrorInteraction(async () => {
  if (!authorizedMirrorSource(event, sourceId) || activeMirrorSourceId !== sourceId) return { ok: false, error: 'Select this mirror tab before enabling interaction.' }
  if (!enabled) {
    await releaseMirrorInput(sourceId)
    interactiveMirrorSourceIds.delete(sourceId)
    return { ok: true, enabled: false }
  }
  const permission = await requestMirrorInput({ action: 'accessibility', prompt: true })
  if (!permission.ok) return permission
  if (!permission.trusted) return { ok: false, needsAccessibility: true, error: 'Enable Accessibility to interact with mirrored windows.' }
  interactiveMirrorSourceIds.add(sourceId)
  return { ok: true, enabled: true }
}))
ipcMain.handle('mirror:raise-original', (event, sourceId) => serializeMirrorInteraction(async () => {
  if (!authorizedMirrorSource(event, sourceId) || activeMirrorSourceId !== sourceId) return { ok: false, error: 'Select this mirror tab before opening its original window.' }
  return sendMirrorWindowAction(sourceId, 'raise')
}))
ipcMain.handle('mirror:input', (event, sourceId, input = {}) => serializeMirrorInteraction(async () => {
  if (!authorizedMirrorSource(event, sourceId) || activeMirrorSourceId !== sourceId || !interactiveMirrorSourceIds.has(sourceId)) return { ok: false, error: 'Turn on Interact for the selected mirrored window first.' }
  const allowedActions = new Set(['move', 'down', 'up', 'rightDown', 'rightUp', 'drag', 'rightDrag', 'wheel', 'keyDown', 'keyUp'])
  if (!allowedActions.has(input.action)) return { ok: false, error: 'Unsupported input event.' }
  const payload = { action: input.action }
  if (input.action === 'keyDown' || input.action === 'keyUp') {
    const code = Number(input.keyCode)
    if (!Number.isInteger(code) || code < 0 || code > 127) return { ok: false, error: 'Unsupported key.' }
    payload.keyCode = code
    payload.flags = Number.isInteger(input.flags) ? input.flags & 0x001e0000 : 0
  } else {
    const x = Number(input.x); const y = Number(input.y)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, error: 'Invalid pointer position.' }
    payload.x = x; payload.y = y
    if (input.action === 'wheel') {
      payload.deltaX = Math.max(-2400, Math.min(2400, Math.round(Number(input.deltaX) || 0)))
      payload.deltaY = Math.max(-2400, Math.min(2400, Math.round(Number(input.deltaY) || 0)))
    }
  }
  // sendMirrorWindowAction writes to the helper synchronously before its promise yields.
  // Record the pending state immediately afterward so a concurrent source switch can
  // enqueue the matching release behind this input instead of missing a held key/button.
  const inputPromise = sendMirrorWindowAction(sourceId, input.action, payload)
  const previousButtons = heldMirrorButtons.get(sourceId)
  const buttonSnapshot = previousButtons
    ? { x: previousButtons.x, y: previousButtons.y, buttons: new Set(previousButtons.buttons) }
    : null
  const previousKeys = heldMirrorKeys.get(sourceId)
  const keySnapshot = previousKeys ? new Map(previousKeys) : null
  if (input.action === 'keyDown') {
    const keys = heldMirrorKeys.get(sourceId) || new Map()
    keys.set(payload.keyCode, payload.flags)
    heldMirrorKeys.set(sourceId, keys)
  } else if (input.action === 'keyUp') {
    const keys = heldMirrorKeys.get(sourceId)
    if (keys) {
      keys.delete(payload.keyCode)
      if (!keys.size) heldMirrorKeys.delete(sourceId)
    }
  }
  if (['down', 'rightDown'].includes(input.action)) {
    const held = heldMirrorButtons.get(sourceId) || { x: payload.x, y: payload.y, buttons: new Set() }
    held.x = payload.x; held.y = payload.y; held.buttons.add(input.action === 'rightDown' ? 'right' : 'left')
    heldMirrorButtons.set(sourceId, held)
  } else if (['up', 'rightUp'].includes(input.action)) {
    const held = heldMirrorButtons.get(sourceId)
    if (held) {
      held.x = payload.x; held.y = payload.y; held.buttons.delete(input.action === 'rightUp' ? 'right' : 'left')
      if (!held.buttons.size) heldMirrorButtons.delete(sourceId)
    }
  } else if (['move', 'drag', 'rightDrag'].includes(input.action)) {
    const held = heldMirrorButtons.get(sourceId)
    if (held) { held.x = payload.x; held.y = payload.y }
  }
  const result = await inputPromise
  if (!result.ok) {
    if (buttonSnapshot) heldMirrorButtons.set(sourceId, buttonSnapshot)
    else heldMirrorButtons.delete(sourceId)
    if (keySnapshot) heldMirrorKeys.set(sourceId, keySnapshot)
    else heldMirrorKeys.delete(sourceId)
    await releaseMirrorInput(sourceId)
    interactiveMirrorSourceIds.delete(sourceId)
    return result
  }
  return result
}))
ipcMain.handle('mirror:open-accessibility-settings', (event) => {
  if (event.sender.id !== mirrorWindow?.webContents.id || process.platform !== 'darwin') return false
  void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  return true
})
ipcMain.handle('mirror:open-screen-settings', (event) => {
  if (event.sender.id !== mirrorWindow?.webContents.id || process.platform !== 'darwin') return false
  void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  return true
})
ipcMain.handle('mirror:close', (event) => serializeMirrorInteraction(() => {
  if (event.sender.id !== mirrorWindow?.webContents.id) return false
  mirrorWindow.close()
  return true
}))
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

app.on('will-quit', (event) => {
  globalShortcut.unregisterAll()
  registeredGlobalShortcuts.clear()
  interactiveMirrorSourceIds.clear()
  const releasePending = [...heldMirrorInputSources()]
  if (releasePending.length) {
    event.preventDefault()
    void serializeMirrorInteraction(async () => {
      for (const sourceId of heldMirrorInputSources()) await releaseMirrorInput(sourceId)
    }).finally(() => {
      mirrorInputProcess?.kill(); stopMirrorInputHelper(); app.quit()
    })
    return
  }
  mirrorInputProcess?.kill()
  stopMirrorInputHelper()
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
