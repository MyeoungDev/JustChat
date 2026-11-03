import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, nativeTheme, screen, session, shell, WebContentsView } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyProviderPopup, isAllowedProviderNavigation, providers, resolveProviderSelection, type ProviderAdapter, type ProviderId } from '../shared/providers'
import { acceleratorFromKeyChord, defaultSettings, normalizeSettings, type AppSettings, type ShortcutName } from '../shared/settings'
import { registerShortcutBindings, replaceShortcutBindings, type ShortcutBindingsByName } from '../shared/shortcut-registry'
import { isTrustedShellSender } from '../shared/security'
import { RetainedViewRegistry } from '../shared/provider-view-registry'
import { centeredBounds, geometryForCurrentDisplay, transitionWindowGeometry, type WindowMode } from '../shared/window-layout'
import { SettingsStore } from './settings-store'
import { clearProviderSessionData } from './provider-session'
import { performance } from 'node:perf_hooks'

type ProviderLoadState = 'loading' | 'ready' | 'error'
type UserSettingsPatch = Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'resetAfterMinutes'>>

const currentDir = dirname(fileURLToPath(import.meta.url))
const rendererFile = join(currentDir, '../renderer/index.html')
const rendererFileUrl = pathToFileURL(rendererFile).href
const isDevelopment = !app.isPackaged
const headerHeight = 48
const performanceEnabled = process.env.JUST_CHAT_PERF === '1' || process.argv.includes('--just-chat-perf')
const appStartTime = performance.now()
const settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'), process.platform)
const webViews = new RetainedViewRegistry<ProviderId, WebContentsView>()
const providerStates = new Map<ProviderId, ProviderLoadState>()
let settings = defaultSettings(process.platform)
let window: BrowserWindow | undefined
let mode: WindowMode = 'popover'
let modeBeforeFullscreen: WindowMode = 'expanded'
let settingsVisible = false
let chatViewVisible = false
let shellContentsId: number | undefined
let shellDevelopmentOrigin: string | undefined
let registeredShortcuts: ShortcutBindingsByName = {}
let shortcutFailures: string[] = []
let saveTimer: NodeJS.Timeout | undefined
let autoHideTimer: NodeJS.Timeout | undefined
let chatResetTimer: NodeJS.Timeout | undefined
let performanceSampler: NodeJS.Timeout | undefined
const providerLoadStarts = new Map<ProviderId, number>()
const providerSwitchStarts = new Map<ProviderId, number>()
const providerLoadTimeouts = new Map<ProviderId, NodeJS.Timeout>()

function shellBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1c1c1b' : '#f6f6f4'
}

nativeTheme.on('updated', () => window?.setBackgroundColor(shellBackgroundColor()))

function recordPerformance(metric: string, values: Record<string, number | string | boolean | null>) {
  if (!performanceEnabled) return
  console.info(`[JUST_CHAT_PERF] ${JSON.stringify({ metric, pid: process.pid, ...values })}`)
}

function timeSince(start: number) {
  return Math.round((performance.now() - start) * 10) / 10
}

function startPerformanceSampler() {
  if (!performanceEnabled) return
  performanceSampler = setInterval(() => {
    for (const process of app.getAppMetrics()) {
      recordPerformance('process-sample', {
        type: process.type,
        cpuPercent: Math.round(process.cpu.percentCPUUsage * 100) / 100,
        workingSetKb: process.memory.workingSetSize
      })
    }
  }, 5000)
  performanceSampler.unref()
}

function showWindow() {
  if (!window || window.isDestroyed()) return
  if (chatResetTimer) clearTimeout(chatResetTimer)
  chatResetTimer = undefined
  const started = performance.now()
  window.once('show', () => recordPerformance('popover-open-ms', { duration: timeSince(started) }))
  window.show()
}

function hideWindow() {
  if (!window || window.isDestroyed()) return
  if (chatResetTimer) clearTimeout(chatResetTimer)
  chatResetTimer = undefined
  if (settings.resetAfterMinutes > 0) {
    chatResetTimer = setTimeout(() => {
      chatResetTimer = undefined
      if (!window || window.isDestroyed() || window.isVisible()) return
      const view = webViews.get('chatgpt')
      if (!view || view.webContents.isDestroyed()) return
      chatViewVisible = false
      providerLoadStarts.set('chatgpt', performance.now())
      setProviderState('chatgpt', 'loading')
      void view.webContents.loadURL(providerFor('chatgpt').url).catch(() => setProviderState('chatgpt', 'error'))
      applyViewBounds()
      sendState()
    }, settings.resetAfterMinutes * 60_000)
    chatResetTimer.unref()
  }
  const started = performance.now()
  window.once('hide', () => recordPerformance('popover-hide-ms', { duration: timeSince(started) }))
  window.hide()
}

function sendState() {
  if (!window || window.isDestroyed()) return
  window.webContents.send('shell:state', {
    mode,
    providerId: settings.activeProviderId,
    providerState: providerStates.get(settings.activeProviderId) ?? 'loading',
    settingsVisible,
    chatViewVisible,
    settings,
    shortcutFailures
  })
}

function saveCurrentBounds() {
  if (!window || window.isDestroyed()) return
  const current = window.getBounds()
  settings.geometry = { ...settings.geometry, [mode]: current }
  settingsStore.save(settings)
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveCurrentBounds, 250)
}

function providerFor(id: ProviderId) {
  return providers.find((provider) => provider.id === id) ?? providers[0]
}

function handleEscape(event: Electron.Event, input: Electron.Input): void {
  if (input.type !== 'keyDown' || input.key !== 'Escape') return
  if (settingsVisible) {
    event.preventDefault()
    settingsVisible = false
    applyViewBounds()
    sendState()
    return
  }
  if (!settings.escapeHidesPopover || !window?.isVisible()) return
  event.preventDefault()
  hideWindow()
}

function handleShellInput(event: Electron.Event, input: Electron.Input): void {
  handleEscape(event, input)
  if (input.type !== 'keyDown' || settingsVisible || !window?.isVisible() || !window.isFocused()) return

  const accelerator = acceleratorFromKeyChord({
    key: input.key,
    code: input.code,
    altKey: input.alt,
    ctrlKey: input.control,
    metaKey: input.meta,
    shiftKey: input.shift
  }, process.platform)
  if (accelerator !== settings.shortcuts.temporaryChat) return

  event.preventDefault()
  startTemporaryChat()
}

function setProviderState(id: ProviderId, state: ProviderLoadState) {
  providerStates.set(id, state)
  const existingTimeout = providerLoadTimeouts.get(id)
  if (existingTimeout) clearTimeout(existingTimeout)
  providerLoadTimeouts.delete(id)
  if (state === 'loading') {
    const timeout = setTimeout(() => {
      providerLoadTimeouts.delete(id)
      if (providerStates.get(id) !== 'loading') return
      console.warn(`[Just Chat] ${id} provider load timed out`)
      setProviderState(id, 'error')
    }, 30_000)
    timeout.unref()
    providerLoadTimeouts.set(id, timeout)
  }
  if (state === 'error') providerSwitchStarts.delete(id)
  if (state === 'ready') {
    const loadStart = providerLoadStarts.get(id)
    if (loadStart !== undefined) {
      recordPerformance('provider-load-ms', { provider: id, duration: timeSince(loadStart) })
      providerLoadStarts.delete(id)
    }
    const switchStart = providerSwitchStarts.get(id)
    if (switchStart !== undefined) {
      recordPerformance('provider-switch-to-ready-ms', { provider: id, duration: timeSince(switchStart) })
      providerSwitchStarts.delete(id)
    }
  }
  const view = webViews.get(id)
  if (view) view.setVisible(id === settings.activeProviderId && chatViewVisible && !settingsVisible)
  if (id === settings.activeProviderId) sendState()
}

function providerPopupHandler(adapter: ProviderAdapter) {
  return ({ url }: Electron.HandlerDetails) => {
    const destination = classifyProviderPopup(url, adapter)
    if (destination === 'external') {
      void shell.openExternal(url).catch(() => undefined)
      return { action: 'deny' as const }
    }
    if (destination === 'provider') {
      return {
        action: 'allow' as const,
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            partition: adapter.sessionPartition,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false
          }
        }
      }
    }
    return { action: 'deny' as const }
  }
}

function guardProviderPopup(popup: BrowserWindow, adapter: ProviderAdapter) {
  popup.webContents.setWindowOpenHandler(providerPopupHandler(adapter))
  popup.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedProviderNavigation(url, adapter)) event.preventDefault()
  })
  popup.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedProviderNavigation(url, adapter)) event.preventDefault()
  })
}

function getProviderView(id: ProviderId) {
  return webViews.getOrCreate(id, () => {
    const adapter = providerFor(id)
    const view = new WebContentsView({
    webPreferences: {
      partition: adapter.sessionPartition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
    })
    const contents = view.webContents

    contents.setWindowOpenHandler(providerPopupHandler(adapter))
    contents.on('did-create-window', (popup) => guardProviderPopup(popup, adapter))
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedProviderNavigation(url, adapter)) {
        event.preventDefault()
        console.warn(`[Just Chat] blocked ${id} main-frame navigation`)
        setProviderState(id, 'error')
      }
    })
    contents.on('will-redirect', (event, url) => {
      if (!isAllowedProviderNavigation(url, adapter)) {
        event.preventDefault()
        console.warn(`[Just Chat] blocked ${id} redirect`)
        setProviderState(id, 'error')
      }
    })
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
    contents.on('did-start-loading', () => setProviderState(id, 'loading'))
    contents.on('did-finish-load', () => setProviderState(id, 'ready'))
    contents.on('did-fail-load', (_event, errorCode, _description, _validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) {
        console.warn(`[Just Chat] ${id} provider load failed (${errorCode})`)
        setProviderState(id, 'error')
      }
    })
    contents.on('render-process-gone', () => setProviderState(id, 'error'))
    contents.on('before-input-event', handleEscape)

    providerStates.set(id, 'loading')
    providerLoadStarts.set(id, performance.now())
    void contents.loadURL(adapter.url).catch(() => setProviderState(id, 'error'))
    return view
  })
}

function applyViewBounds() {
  if (!window || window.isDestroyed()) return
  const [width, height] = window.getContentSize()
  const view = webViews.get(settings.activeProviderId)
  if (!view) return
  view.setBounds({ x: 0, y: headerHeight, width, height: Math.max(0, height - headerHeight) })
  view.setVisible(chatViewVisible && !settingsVisible)
  for (const [id, other] of webViews.entries()) if (id !== settings.activeProviderId) other.setVisible(false)
}

function getWorkAreaFor(bounds: { x: number; y: number; width: number; height: number }) {
  return screen.getDisplayNearestPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }).workArea
}

function setMode(nextMode: WindowMode) {
  if (!window || window.isDestroyed() || mode === nextMode) return
  const oldBounds = window.getBounds()
  const currentCenter = { x: oldBounds.x + oldBounds.width / 2, y: oldBounds.y + oldBounds.height / 2 }
  const currentDisplay = screen.getDisplayNearestPoint(currentCenter)
  const savedBounds = settings.geometry[nextMode]
  const savedDisplay = savedBounds
    ? screen.getDisplayNearestPoint({ x: savedBounds.x + savedBounds.width / 2, y: savedBounds.y + savedBounds.height / 2 })
    : undefined
  const displayGeometry = geometryForCurrentDisplay(settings.geometry, nextMode, nextMode !== 'fullscreen' && savedDisplay?.id === currentDisplay.id)
  const targetArea = nextMode === 'fullscreen' ? currentDisplay.bounds : currentDisplay.workArea
  const result = transitionWindowGeometry(mode, oldBounds, nextMode, displayGeometry, targetArea, centeredBounds(nextMode, targetArea))
  const started = performance.now()
  settings.geometry = result.geometry
  mode = result.mode
  window.setMinimumSize(Math.min(nextMode === 'popover' ? 560 : 800, targetArea.width), Math.min(nextMode === 'popover' ? 160 : 600, targetArea.height))
  window.setBounds(result.bounds, true)
  window.setAlwaysOnTop(settings.alwaysOnTop)
  settingsStore.save(settings)
  sendState()
  applyViewBounds()
  recordPerformance(`window-${nextMode}-api-ms`, { duration: timeSince(started) })
}

function setProvider(id: ProviderId) {
  const selection = resolveProviderSelection(settings.activeProviderId, id)
  if (!selection?.changed) return
  const previousView = webViews.get(settings.activeProviderId)
  const started = performance.now()
  if (previousView && window && !window.isDestroyed()) window.contentView.removeChildView(previousView)
  settings.activeProviderId = selection.providerId
  providerSwitchStarts.set(id, started)
  if (window && !window.isDestroyed()) {
    const nextView = getProviderView(id)
    window.contentView.addChildView(nextView)
    applyViewBounds()
  }
  settingsStore.save(settings)
  sendState()
  if (providerStates.get(id) === 'ready') {
    recordPerformance('provider-switch-warm-ms', { provider: id, duration: timeSince(started) })
    providerSwitchStarts.delete(id)
  }
  if (window?.isVisible()) focusChatView()
}

function startTemporaryChat() {
  if (!window || window.isDestroyed()) return
  setProvider('chatgpt')
  chatViewVisible = true
  applyViewBounds()
  sendState()
  const view = webViews.get('chatgpt')
  if (!view) return
  settingsVisible = false
  applyViewBounds()
  sendState()

  const dispatchShortcut = () => {
    if (!window || window.isDestroyed() || view.webContents.isDestroyed()) return
    view.webContents.focus()
    const modifiers: ('meta' | 'control' | 'shift')[] = process.platform === 'darwin' ? ['meta', 'shift'] : ['control', 'shift']
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'N', modifiers })
    view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'N', modifiers })
  }

  if (providerStates.get('chatgpt') !== 'ready') {
    showWindow()
    window.focus()
    sendState()
    return
  }
  if (window.isFocused()) dispatchShortcut()
  else window.once('focus', dispatchShortcut)
  showWindow()
  window.focus()
}

function openChatHistory() {
  if (!window || window.isDestroyed()) return
  setProvider('chatgpt')
  chatViewVisible = true
  settingsVisible = false
  applyViewBounds()
  sendState()
  const view = webViews.get('chatgpt')
  if (!view || providerStates.get('chatgpt') !== 'ready') {
    showWindow()
    window.focus()
    return
  }
  const dispatchSearch = () => {
    if (!window || window.isDestroyed() || view.webContents.isDestroyed()) return
    view.webContents.focus()
    const modifiers: ('meta' | 'control')[] = process.platform === 'darwin' ? ['meta'] : ['control']
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers })
    view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'K', modifiers })
  }
  if (window.isFocused()) dispatchSearch()
  else window.once('focus', dispatchSearch)
  showWindow()
  window.focus()
}

function retryProvider() {
  const view = webViews.get(settings.activeProviderId)
  if (!view) return
  setProviderState(settings.activeProviderId, 'loading')
  void view.webContents.reload()
}

async function submitPrompt(promptValue: unknown): Promise<{ ok: boolean; reason?: string }> {
  if (typeof promptValue !== 'string' || !promptValue.trim()) return { ok: false, reason: 'empty' }
  const prompt = promptValue.trim()
  if (prompt.length > 50_000) return { ok: false, reason: 'too-long' }
  if (!window || window.isDestroyed()) return { ok: false, reason: 'window-unavailable' }

  setProvider('chatgpt')
  const view = getProviderView('chatgpt')
  const contents = view.webContents
  try {
    await contents.loadURL(providerFor('chatgpt').url)
    let composerReady = false
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (contents.isDestroyed()) return { ok: false, reason: 'page-unavailable' }
      composerReady = await contents.executeJavaScript(`Boolean(document.querySelector('#prompt-textarea, [contenteditable="true"][role="textbox"], textarea[placeholder]'))`).catch(() => false)
      if (composerReady) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!composerReady) return { ok: false, reason: 'composer-not-found' }

    const focused = await contents.executeJavaScript(`(() => {
      const editor = document.querySelector('#prompt-textarea, [contenteditable="true"][role="textbox"], textarea[placeholder]');
      if (!editor) return false;
      editor.focus();
      return true;
    })()`).catch(() => false)
    if (!focused) return { ok: false, reason: 'composer-not-found' }
    contents.focus()
    contents.insertText(prompt)

    let textInserted = false
    for (let attempt = 0; attempt < 16; attempt += 1) {
      textInserted = await contents.executeJavaScript(`(() => {
        const editor = document.querySelector('#prompt-textarea, [contenteditable="true"][role="textbox"], textarea[placeholder]');
        return Boolean(editor && (editor.value || editor.innerText || editor.textContent || '').trim());
      })()`).catch(() => false)
      if (textInserted) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!textInserted) return { ok: false, reason: 'text-entry-failed' }

    const clicked = await contents.executeJavaScript(`(() => {
      const button = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="보내기"], form button[type="submit"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`).catch(() => false)
    if (!clicked) {
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
    }

    chatViewVisible = true
    applyViewBounds()
    showWindow()
    window.focus()
    contents.focus()
    sendState()
    return { ok: true }
  } catch {
    return { ok: false, reason: 'provider-interaction-failed' }
  }
}

async function openChatManually(promptValue: unknown): Promise<{ ok: boolean; reason?: string }> {
  if (typeof promptValue !== 'string' || !promptValue.trim()) return { ok: false, reason: 'empty' }
  if (promptValue.length > 50_000) return { ok: false, reason: 'too-long' }
  if (!window || window.isDestroyed()) return { ok: false, reason: 'window-unavailable' }
  clipboard.writeText(promptValue)
  setProvider('chatgpt')
  const view = getProviderView('chatgpt')
  chatViewVisible = true
  settingsVisible = false
  applyViewBounds()
  sendState()
  showWindow()
  window.focus()
  try {
    await view.webContents.loadURL(providerFor('chatgpt').url)
  } catch {
    chatViewVisible = false
    applyViewBounds()
    sendState()
    return { ok: false, reason: 'provider-load-failed' }
  }
  view.webContents.focus()
  return { ok: true }
}

function showComposer() {
  chatViewVisible = false
  applyViewBounds()
  sendState()
}

function focusChatView() {
  if (!window || window.isDestroyed() || settingsVisible) return
  window.focus()
  if (!chatViewVisible) return
  const view = webViews.get(settings.activeProviderId)
  if (view && providerStates.get(settings.activeProviderId) === 'ready') view.webContents.focus()
}

function toggleWindow() {
  if (!window || window.isDestroyed()) return
  if (window.isVisible()) {
    hideWindow()
    return
  }
  if (mode !== 'popover') setMode('popover')
  showWindow()
  focusChatView()
}

function toggleFullscreen() {
  if (mode === 'fullscreen') {
    setMode(modeBeforeFullscreen)
    return
  }
  modeBeforeFullscreen = mode
  setMode('fullscreen')
}

function desiredBindings(candidate: AppSettings): ShortcutBindingsByName {
  const bindings: ShortcutBindingsByName = {
    toggle: candidate.shortcuts.toggle,
    'chat-history': candidate.shortcuts.chatHistory
  }
  return bindings
}

function shortcutCallbacks() {
  return Object.fromEntries([
    ['toggle', toggleWindow],
    ['chat-history', openChatHistory]
  ]) as Record<ShortcutName, () => void>
}

function replaceBindings(candidate: AppSettings): string[] {
  const api = { register: (accelerator: string, callback: () => void) => globalShortcut.register(accelerator, callback), unregister: (accelerator: string) => globalShortcut.unregister(accelerator) }
  const result = replaceShortcutBindings(api, registeredShortcuts, desiredBindings(candidate), shortcutCallbacks())
  registeredShortcuts = result.registered
  return result.failed
}

function registerStartupBindings() {
  const api = { register: (accelerator: string, callback: () => void) => globalShortcut.register(accelerator, callback), unregister: (accelerator: string) => globalShortcut.unregister(accelerator) }
  const attempt = registerShortcutBindings(api, desiredBindings(settings), shortcutCallbacks())
  registeredShortcuts = attempt.registered
  shortcutFailures = attempt.failed
}

function isTrustedShell(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  if (!window || window.isDestroyed()) return false
  const frame = event.senderFrame
  if (!frame) return false
  return isTrustedShellSender(event.sender.id, shellContentsId, frame === event.sender.mainFrame, frame.url, shellDevelopmentOrigin, rendererFileUrl)
}

function applyWindowPreferences() {
  window?.setAlwaysOnTop(settings.alwaysOnTop)
  scheduleSave()
  sendState()
}

function createWindow() {
  if (window && !window.isDestroyed()) return
  const stored = settings.geometry.popover
  const initialDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const bounds = stored ?? centeredBounds('popover', initialDisplay)
  const workArea = getWorkAreaFor(bounds)
  const bounded = transitionWindowGeometry('popover', bounds, 'popover', {}, workArea, centeredBounds('popover', workArea)).bounds

  window = new BrowserWindow({
    ...bounded,
    minWidth: Math.min(560, workArea.width),
    minHeight: Math.min(160, workArea.height),
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: shellBackgroundColor(),
    webPreferences: {
      preload: join(currentDir, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })
  shellContentsId = window.webContents.id
  try { shellDevelopmentOrigin = isDevelopment && process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : undefined } catch { shellDevelopmentOrigin = undefined }
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (isDevelopment) {
      try {
        const expectedOrigin = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : ''
        if (expectedOrigin && new URL(url).origin === expectedOrigin) return
      } catch { /* malformed navigation is blocked below */ }
    } else if (url === rendererFileUrl) return
    event.preventDefault()
  })
  window.webContents.on('before-input-event', handleShellInput)
  if (isDevelopment) void window.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else void window.loadFile(rendererFile)

  window.contentView.addChildView(getProviderView(settings.activeProviderId))
  window.on('resize', () => { applyViewBounds(); scheduleSave() })
  window.on('move', scheduleSave)
  window.on('blur', () => {
    if (!settings.autoHidePopover || mode !== 'popover') return
    if (autoHideTimer) clearTimeout(autoHideTimer)
    autoHideTimer = setTimeout(() => {
      if (window && !window.isDestroyed() && !window.isModal() && window.isVisible() && mode === 'popover' && !window.isFocused()) hideWindow()
    }, 400)
  })
  window.on('focus', () => { if (autoHideTimer) clearTimeout(autoHideTimer) })
  const appWindow = window
  appWindow.once('ready-to-show', () => {
    recordPerformance('cold-start-to-shell-ready-ms', { duration: timeSince(appStartTime), windowId: appWindow.id })
    applyViewBounds()
    appWindow.show()
    focusChatView()
    sendState()
  })
  window.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer)
    settings.geometry = { ...settings.geometry, [mode]: window!.getBounds() }
    settingsStore.save(settings)
  })
  window.on('closed', () => { window = undefined; shellContentsId = undefined })
}

app.whenReady().then(() => {
  startPerformanceSampler()
  settings = settingsStore.load()
  registerStartupBindings()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else toggleWindow()
  })
})

app.on('will-quit', () => {
  for (const accelerator of Object.values(registeredShortcuts)) if (accelerator) globalShortcut.unregister(accelerator)
  if (saveTimer) clearTimeout(saveTimer)
  if (autoHideTimer) clearTimeout(autoHideTimer)
  if (chatResetTimer) clearTimeout(chatResetTimer)
  if (performanceSampler) clearInterval(performanceSampler)
  for (const timeout of providerLoadTimeouts.values()) clearTimeout(timeout)
  if (window && !window.isDestroyed()) settingsStore.save(settings)
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
})

ipcMain.handle('shell:get-state', (event) => {
  if (!isTrustedShell(event)) return null
  return {
    mode,
    providerId: settings.activeProviderId,
    providerState: providerStates.get(settings.activeProviderId) ?? 'loading',
    settingsVisible,
    chatViewVisible,
    settings,
    shortcutFailures
  }
})

ipcMain.handle('settings:update', (event, patch: UserSettingsPatch) => {
  if (!isTrustedShell(event) || !patch || typeof patch !== 'object') return { ok: false, reason: 'untrusted' }
  const candidate = normalizeSettings({
    ...settings,
    alwaysOnTop: typeof patch.alwaysOnTop === 'boolean' ? patch.alwaysOnTop : settings.alwaysOnTop,
    autoHidePopover: typeof patch.autoHidePopover === 'boolean' ? patch.autoHidePopover : settings.autoHidePopover,
    escapeHidesPopover: typeof patch.escapeHidesPopover === 'boolean' ? patch.escapeHidesPopover : settings.escapeHidesPopover,
    resetAfterMinutes: typeof patch.resetAfterMinutes === 'number' ? patch.resetAfterMinutes : settings.resetAfterMinutes,
    shortcuts: patch.shortcuts ? { ...settings.shortcuts, ...patch.shortcuts, providers: { ...settings.shortcuts.providers, ...patch.shortcuts.providers } } : settings.shortcuts
  }, process.platform)
  const failures = patch.shortcuts ? replaceBindings(candidate) : []
  if (failures.length) return { ok: false, failures }
  settings = candidate
  if (patch.shortcuts) shortcutFailures = []
  settingsStore.save(settings)
  applyWindowPreferences()
  return { ok: true, settings, failures: shortcutFailures }
})

ipcMain.handle('provider:clear-chatgpt-session', async (event) => {
  if (!isTrustedShell(event)) return { ok: false, cleared: false, reason: 'untrusted' as const }

  const adapter = providerFor('chatgpt')
  const chatgptView = webViews.get('chatgpt') ?? getProviderView('chatgpt')
  const contents = chatgptView.webContents
  const providerSession = !contents.isDestroyed() ? contents.session : session.fromPartition(adapter.sessionPartition)

  try {
    await clearProviderSessionData(providerSession)
  } catch {
    return { ok: false, cleared: false, reason: 'clear-failed' as const }
  }

  if (settings.activeProviderId === 'chatgpt') {
    chatViewVisible = true
    applyViewBounds()
    sendState()
  }

  if (contents.isDestroyed()) return { ok: true, cleared: true }

  providerLoadStarts.set('chatgpt', performance.now())
  setProviderState('chatgpt', 'loading')
  try {
    await contents.loadURL(adapter.url)
    return { ok: true, cleared: true }
  } catch {
    setProviderState('chatgpt', 'error')
    return { ok: false, cleared: true, reason: 'reload-failed' as const }
  }
})

ipcMain.on('app:expand', (event) => { if (isTrustedShell(event)) setMode('expanded') })
ipcMain.on('app:collapse', (event) => { if (isTrustedShell(event)) setMode('popover') })
ipcMain.on('app:fullscreen', (event) => { if (isTrustedShell(event)) toggleFullscreen() })
ipcMain.on('app:hide', (event) => { if (isTrustedShell(event)) hideWindow() })
ipcMain.on('app:settings', (event, visible: boolean) => {
  if (!isTrustedShell(event)) return
  settingsVisible = Boolean(visible)
  applyViewBounds()
  sendState()
})
ipcMain.on('app:provider', (event, id: ProviderId) => { if (isTrustedShell(event)) setProvider(id) })
ipcMain.on('app:retry-provider', (event) => { if (isTrustedShell(event)) retryProvider() })
ipcMain.handle('chat:submit-prompt', (event, prompt: unknown) => isTrustedShell(event) ? submitPrompt(prompt) : { ok: false, reason: 'untrusted' })
ipcMain.handle('chat:open-manually', (event, prompt: unknown) => isTrustedShell(event) ? openChatManually(prompt) : { ok: false, reason: 'untrusted' })
ipcMain.on('chat:show-composer', (event) => { if (isTrustedShell(event)) showComposer() })
