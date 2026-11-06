import { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, nativeTheme, screen, session, shell, WebContentsView } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyProviderPopup, isAllowedProviderNavigation, isSecureProviderRedirect, providers, resolveProviderSelection, type ProviderAdapter, type ProviderId } from '../shared/providers'
import { defaultSettings, normalizeSettings, validateShortcutMap, type AppSettings, type ShortcutName } from '../shared/settings'
import { shouldDispatchFocusedShortcut } from '../shared/shortcut-dispatch'
import { globalShortcutBindings, registerShortcutBindings, replaceShortcutBindings, type ShortcutBindingsByName } from '../shared/shortcut-registry'
import { isTrustedShellSender } from '../shared/security'
import { RetainedViewRegistry } from '../shared/provider-view-registry'
import { boundsAnchoredAtBottom, boundsForDisplay, centeredBounds, geometryForCurrentDisplay, lowerCenteredBounds, minimumWindowSizes, modeForProviderPage, rememberDisplayBounds, transitionWindowGeometry, type WindowMode } from '../shared/window-layout'
import { chatGPTConversationPath, hasChatGPTConversationRoute, isChatGPTSendKey, isCloseWindowShortcut, isSettingsToggleShortcut, shouldHideWindowOnBlur } from '../shared/window-behavior'
import { SettingsStore } from './settings-store'
import { clearProviderSessionData } from './provider-session'
import { performance } from 'node:perf_hooks'

type ProviderLoadState = 'loading' | 'ready' | 'error'
type UserSettingsPatch = Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'opacity' | 'theme' | 'opacityMode' | 'backgroundOpacity' | 'pageZoomPercent' | 'resetAfterMinutes'>>

const currentDir = dirname(fileURLToPath(import.meta.url))
const rendererFile = join(currentDir, '../renderer/index.html')
const rendererFileUrl = pathToFileURL(rendererFile).href
const appIconPath = join(app.getAppPath(), 'assets', 'icon.png')
const isDevelopment = !app.isPackaged
const headerHeight = 48
const performanceEnabled = process.env.JUST_CHAT_PERF === '1' || process.argv.includes('--just-chat-perf')
const appStartTime = performance.now()
const settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'), process.platform)
const webViews = new RetainedViewRegistry<ProviderId, WebContentsView>()
const providerStates = new Map<ProviderId, ProviderLoadState>()
let settings = defaultSettings(process.platform)
let window: BrowserWindow | undefined
let windowHasBeenFocused = false
let suppressQuickChatBlurUntil = 0
let mode: WindowMode = 'compact'
let modeBeforeFullscreen: WindowMode = 'compact'
let settingsVisible = false
let shellContentsId: number | undefined
let shellDevelopmentOrigin: string | undefined
let registeredShortcuts: ShortcutBindingsByName = {}
let shortcutFailures: string[] = []
let saveTimer: NodeJS.Timeout | undefined
let autoHideTimer: NodeJS.Timeout | undefined
let chatResetTimer: NodeJS.Timeout | undefined
let compactAuthDialogTimer: NodeJS.Timeout | undefined
let authDialogCheckInFlight = false
let performanceSampler: NodeJS.Timeout | undefined
const providerLoadStarts = new Map<ProviderId, number>()
const providerSwitchStarts = new Map<ProviderId, number>()
const providerLoadTimeouts = new Map<ProviderId, NodeJS.Timeout>()
const timedOutProviders = new Set<ProviderId>()

function shellBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1c1c1b' : '#f6f6f4'
}

function effectiveWindowBackground() {
  return settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt' ? '#00000000' : shellBackgroundColor()
}

function syncProviderViewBackground(id: ProviderId) {
  const view = webViews.get(id)
  if (!view || view.webContents.isDestroyed()) return
  const selectiveBackground = id === 'chatgpt' && settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt'
  view.setBackgroundColor(selectiveBackground ? '#00000000' : shellBackgroundColor())
}

function syncProviderViewBackgrounds() {
  for (const id of providers.map((provider) => provider.id)) syncProviderViewBackground(id)
}

nativeTheme.on('updated', () => {
  window?.setBackgroundColor(effectiveWindowBackground())
  syncProviderViewBackgrounds()
})

function recordPerformance(metric: string, values: Record<string, number | string | boolean | null>) {
  if (!performanceEnabled) return
  console.info(`[JUST_CHAT_PERF] ${JSON.stringify({ metric, pid: process.pid, ...values })}`)
}

function timeSince(start: number) {
  return Math.round((performance.now() - start) * 10) / 10
}

function logChatGPTReadiness(contents: Electron.WebContents, phase: string) {
  if (contents.isDestroyed()) return
  void contents.executeJavaScript(`(() => {
    const text = document.body?.innerText || '';
    const visible = (selector) => Array.from(document.querySelectorAll(selector)).some(element =>
      element instanceof HTMLElement && element.getClientRects().length > 0
    );
    return {
      readyState: document.readyState,
      bodyTextLength: text.length,
      bodyChildCount: document.body?.children.length || 0,
      hasComposer: visible('#prompt-textarea, [data-testid="composer"] [contenteditable], [contenteditable]:not([contenteditable="false"]), [role="textbox"], textarea'),
      hasMainContent: visible('main, [role="main"], [data-testid*="conversation"], [data-testid*="composer"]'),
      showsSignIn: /log in|sign in|로그인|회원가입/i.test(text),
      showsChallenge: /verify you are human|checking your browser|사람인지 확인/i.test(text)
    };
  })()`).then((state: { readyState: string; bodyTextLength: number; bodyChildCount: number; hasComposer: boolean; hasMainContent: boolean; showsSignIn: boolean; showsChallenge: boolean }) => {
    console.info(`[Just Chat] ChatGPT ${phase}: ${JSON.stringify(state)}`)
  }).catch(() => undefined)
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
  suppressQuickChatBlurUntil = Date.now() + 1000
  if (chatResetTimer) clearTimeout(chatResetTimer)
  chatResetTimer = undefined
  if (!window.isVisible()) positionWindowOnCursorDisplay()
  const started = performance.now()
  window.once('show', () => recordPerformance('popover-open-ms', { duration: timeSince(started) }))
  window.show()
  syncCompactAuthDialogMonitor()
}

function hideWindow() {
  if (!window || window.isDestroyed()) return
  if (chatResetTimer) clearTimeout(chatResetTimer)
  chatResetTimer = undefined
  if (settings.resetAfterMinutes > 0 && settings.activeProviderId === 'chatgpt') {
    chatResetTimer = setTimeout(() => {
      chatResetTimer = undefined
      if (!window || window.isDestroyed() || window.isVisible() || settings.activeProviderId !== 'chatgpt') return
      const view = webViews.get('chatgpt')
      if (!view || view.webContents.isDestroyed()) return
      settings.lastChatGPTConversationPath = undefined
      resetWindowToCompactDefaults()
      providerLoadStarts.set('chatgpt', performance.now())
      setProviderState('chatgpt', 'loading')
      void view.webContents.loadURL(providerFor('chatgpt').url).catch(() => setProviderState('chatgpt', 'error'))
      sendState()
    }, settings.resetAfterMinutes * 60_000)
    chatResetTimer.unref()
  }
  const started = performance.now()
  window.once('hide', () => recordPerformance('popover-hide-ms', { duration: timeSince(started) }))
  window.hide()
  syncCompactAuthDialogMonitor()
}

function sendState() {
  if (!window || window.isDestroyed()) return
  window.webContents.send('shell:state', {
    mode,
    providerId: settings.activeProviderId,
    providerState: providerStates.get(settings.activeProviderId) ?? 'loading',
    settingsVisible,
    settings,
    shortcutFailures
  })
}

function saveCurrentBounds() {
  if (!window || window.isDestroyed()) return
  const current = window.getBounds()
  const display = screen.getDisplayNearestPoint({ x: current.x + current.width / 2, y: current.y + current.height / 2 })
  settings.geometry = { ...settings.geometry, [mode]: current }
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, mode, String(display.id), current)
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
    setSettingsVisibility(false)
    return
  }
  if (!settings.escapeHidesPopover || !window?.isVisible()) return
  event.preventDefault()
  hideWindow()
}

function setSettingsVisibility(visible: boolean) {
  if (!window || window.isDestroyed() || settingsVisible === visible) return
  settingsVisible = visible
  if (visible) {
    applyViewBounds()
    syncCompactAuthDialogMonitor()
    window.webContents.focus()
  } else {
    showChatView()
    webViews.get(settings.activeProviderId)?.webContents.focus()
  }
  sendState()
}

function handleSettingsShortcut(event: Electron.Event, input: Electron.Input): boolean {
  if (!isSettingsToggleShortcut(input, process.platform) || !window?.isVisible() || !window.isFocused()) return false
  event.preventDefault()
  setSettingsVisibility(!settingsVisible)
  return true
}

function handleCloseWindowShortcut(event: Electron.Event, input: Electron.Input): boolean {
  if (!isCloseWindowShortcut(input, process.platform) || !window?.isVisible() || !window.isFocused()) return false
  event.preventDefault()
  hideWindow()
  return true
}

function handleShellInput(event: Electron.Event, input: Electron.Input): void {
  if (handleCloseWindowShortcut(event, input)) return
  if (handleSettingsShortcut(event, input)) return
  handleEscape(event, input)
  dispatchWindowSizeShortcut(event, input)
  dispatchTemporaryChatShortcut(event, input)
  handlePageZoomShortcut(event, input)
}

function handleProviderInput(event: Electron.Event, input: Electron.Input): void {
  if (handleCloseWindowShortcut(event, input)) return
  if (handleSettingsShortcut(event, input)) return
  handleEscape(event, input)
  dispatchWindowSizeShortcut(event, input)
  dispatchTemporaryChatShortcut(event, input)
  handlePageZoomShortcut(event, input)
  if (settings.activeProviderId === 'chatgpt' && mode === 'compact' && isChatGPTSendKey(input)) {
    setMode('expanded')
  }
}

function dispatchWindowSizeShortcut(event: Electron.Event, input: Electron.Input): void {
  const matches = shouldDispatchFocusedShortcut({
    key: input.key,
    code: input.code,
    altKey: input.alt,
    ctrlKey: input.control,
    metaKey: input.meta,
    shiftKey: input.shift
  }, process.platform, settings.shortcuts.toggleSize, {
    eventType: input.type,
    settingsVisible,
    windowVisible: Boolean(window?.isVisible()),
    windowFocused: Boolean(window?.isFocused()),
    windowMode: mode
  })
  if (!matches) return
  event.preventDefault()
  setMode(mode === 'compact' ? 'expanded' : 'compact')
}

function handlePageZoomShortcut(event: Electron.Event, input: Electron.Input): void {
  if (input.type !== 'keyDown' || input.alt) return
  const modifierPressed = process.platform === 'darwin' ? input.meta && !input.control : input.control && !input.meta
  if (!modifierPressed) return

  const view = webViews.get(settings.activeProviderId)
  if (!view || view.webContents.isDestroyed()) return

  const key = input.key.toLowerCase()
  const code = input.code.toLowerCase()
  if (key === '0' || code === 'digit0' || code === 'numpad0') {
    event.preventDefault()
    view.webContents.setZoomLevel(0)
    return
  }

  const zoomOut = key === '-' || code === 'minus' || code === 'numpadsubtract'
  const zoomIn = key === '+' || (code === 'equal' && input.shift) || code === 'numpadadd'
  if (!zoomIn && !zoomOut) return

  event.preventDefault()
  const currentLevel = view.webContents.getZoomLevel()
  view.webContents.setZoomLevel(Math.max(-3, Math.min(3, currentLevel + (zoomIn ? 0.5 : -0.5))))
}

function dispatchTemporaryChatShortcut(event: Electron.Event, input: Electron.Input): void {
  if (settings.activeProviderId !== 'chatgpt') return
  const matches = shouldDispatchFocusedShortcut({
    key: input.key,
    code: input.code,
    altKey: input.alt,
    ctrlKey: input.control,
    metaKey: input.meta,
    shiftKey: input.shift
  }, process.platform, settings.shortcuts.temporaryChat, {
    eventType: input.type,
    settingsVisible,
    windowVisible: Boolean(window?.isVisible()),
    windowFocused: Boolean(window?.isFocused()),
    windowMode: mode
  })
  if (!matches) return
  const view = webViews.get('chatgpt')
  if (!view || view.webContents.isDestroyed()) return
  event.preventDefault()
  void view.webContents.executeJavaScript(`(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const temporaryChatButton = buttons.find(button => {
      const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-testid'), button.textContent]
        .filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim();
      return /temporary[\\s-]*chat|임시\\s*채팅/i.test(label);
    });
    if (!temporaryChatButton) return false;
    temporaryChatButton.click();
    return true;
  })()`).then((started: boolean) => {
    if (!started) console.info('[Just Chat] Temporary Chat shortcut unavailable; the ChatGPT button is not present.')
  }).catch(() => undefined)
}

function setProviderState(id: ProviderId, state: ProviderLoadState) {
  providerStates.set(id, state)
  if (state === 'loading') timedOutProviders.delete(id)
  const existingTimeout = providerLoadTimeouts.get(id)
  if (existingTimeout) clearTimeout(existingTimeout)
  providerLoadTimeouts.delete(id)
  if (state === 'loading') {
    const timeout = setTimeout(() => {
      providerLoadTimeouts.delete(id)
      if (providerStates.get(id) !== 'loading') return
      const view = webViews.get(id)
      if (!view || view.webContents.isDestroyed()) return
      const contents = view.webContents
      if (!contents.isLoadingMainFrame()) {
        console.info(`[Just Chat] ${id} main frame stopped loading; clearing stale load timeout`)
        setProviderState(id, 'ready')
        return
      }
      let host = 'unknown'
      try { host = new URL(contents.getURL()).hostname } catch { /* URL may not be available yet */ }
      console.warn(`[Just Chat] ${id} main-frame load timed out at ${host}`)
      timedOutProviders.add(id)
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
  if (view) view.setVisible(state !== 'error' && id === settings.activeProviderId && !settingsVisible)
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

function canWriteSanitizedClipboard(permission: string, requestingUrl: string | undefined, isMainFrame: boolean, adapter: ProviderAdapter): boolean {
  if (permission !== 'clipboard-sanitized-write' || !requestingUrl || !isMainFrame) return false
  try {
    const url = new URL(requestingUrl)
    return url.protocol === 'https:' && adapter.allowedTopLevelHosts.some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
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
    const selectiveBackground = id === 'chatgpt' && settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt'
    view.setBackgroundColor(selectiveBackground ? '#00000000' : shellBackgroundColor())
    const contents = view.webContents
    contents.setZoomMode('isolated')
    contents.setZoomFactor(settings.pageZoomPercent / 100)

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
      // Auth providers may add redirect hosts that are not known in advance.
      // Keep HTTPS redirect hops in the embedded session, as Quick Chat does;
      // user-started top-level navigations and popups still use the host allowlist.
      if (!isSecureProviderRedirect(url)) {
        event.preventDefault()
        let redirectHost = 'invalid URL'
        try { redirectHost = new URL(url).hostname } catch { /* keep URL paths and query parameters out of logs */ }
        console.warn(`[Just Chat] blocked ${id} redirect to ${redirectHost}`)
        setProviderState(id, 'error')
      }
    })
    contents.on('did-redirect-navigation', (_event, url, _inPlace, isMainFrame) => {
      if (!isMainFrame) return
      let host = 'unknown'
      try { host = new URL(url).hostname } catch { /* keep full URLs out of logs */ }
      console.info(`[Just Chat] ${id} redirected to ${host}`)
    })
    contents.session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      callback(canWriteSanitizedClipboard(permission, details.requestingUrl, details.isMainFrame, adapter))
    })
    contents.session.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
      return canWriteSanitizedClipboard(permission, details.requestingUrl ?? requestingOrigin, details.isMainFrame, adapter)
    })
    contents.on('did-start-loading', () => {
      let host = 'unknown'
      try { host = new URL(contents.getURL()).hostname } catch { /* URL may not be available yet */ }
      console.info(`[Just Chat] ${id} load started at ${host}`)
      setProviderState(id, 'loading')
    })
    contents.on('dom-ready', () => {
      if (id === 'chatgpt') logChatGPTReadiness(contents, 'DOM ready')
      setProviderState(id, 'ready')
      if (window?.isVisible() && !settingsVisible && settings.activeProviderId === id) setTimeout(focusChatComposer, 200)
    })
    contents.on('did-frame-finish-load', (_event, isMainFrame) => {
      if (isMainFrame) setProviderState(id, 'ready')
    })
    contents.on('did-finish-load', () => {
      setProviderState(id, 'ready')
      if (id === 'chatgpt') syncCompactWelcome()
      if (id === 'chatgpt') syncBackgroundOpacity()
      if (window?.isVisible() && !settingsVisible && settings.activeProviderId === id) setTimeout(focusChatComposer, 100)
    })
    contents.on('did-stop-loading', () => {
      if (id === 'chatgpt') logChatGPTReadiness(contents, 'load stopped')
      if (providerStates.get(id) === 'loading' || timedOutProviders.has(id)) {
        console.info(`[Just Chat] ${id} load stopped; marking provider ready`)
        timedOutProviders.delete(id)
        setProviderState(id, 'ready')
      }
      if (id === 'chatgpt') syncCompactWelcome()
      if (id === 'chatgpt') syncBackgroundOpacity()
      if (window?.isVisible() && !settingsVisible && settings.activeProviderId === id) setTimeout(focusChatComposer, 100)
    })
    contents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) {
        let host = 'unknown'
        try { host = new URL(validatedURL).hostname } catch { /* keep URLs out of logs */ }
        console.warn(`[Just Chat] ${id} main-frame load failed (${errorCode}) at ${host}`)
        setProviderState(id, 'error')
      }
    })
    contents.on('render-process-gone', (_event, details) => {
      console.error(`[Just Chat] ${id} renderer exited (${details.reason}, ${details.exitCode})`)
      setProviderState(id, 'error')
    })
    contents.on('before-input-event', handleProviderInput)
    const expandForConversation = () => {
      if (id === 'chatgpt') {
        const conversationPath = chatGPTConversationPath(id, contents.getURL())
        if (settings.lastChatGPTConversationPath !== conversationPath) {
          settings.lastChatGPTConversationPath = conversationPath
          settingsStore.save(settings)
        }
      }
      if (id === 'chatgpt' && mode === 'compact' && hasChatGPTConversationRoute(id, contents.getURL())) setMode('expanded')
      else if (id === 'chatgpt') syncCompactWelcome()
    }
    contents.on('did-navigate', expandForConversation)
    contents.on('did-navigate-in-page', expandForConversation)

    providerStates.set(id, 'loading')
    providerLoadStarts.set(id, performance.now())
    const initialUrl = id === 'chatgpt' && settings.lastChatGPTConversationPath
      ? new URL(settings.lastChatGPTConversationPath, adapter.url).toString()
      : adapter.url
    void contents.loadURL(initialUrl).catch(() => setProviderState(id, 'error'))
    return view
  }, view => !view.webContents.isDestroyed())
}

function applyViewBounds() {
  if (!window || window.isDestroyed()) return
  const [width, height] = window.getContentSize()
  const view = webViews.get(settings.activeProviderId)
  if (!view) return
  view.setBounds({ x: 0, y: headerHeight, width, height: Math.max(0, height - headerHeight) })
  view.setVisible(!settingsVisible && providerStates.get(settings.activeProviderId) !== 'error')
  for (const [id, other] of webViews.entries()) if (id !== settings.activeProviderId) other.setVisible(false)
}

function syncCompactAuthDialogMonitor() {
  const shouldMonitor = Boolean(
    window && !window.isDestroyed() && window.isVisible() && !settingsVisible
      && mode === 'compact' && settings.activeProviderId === 'chatgpt'
  )
  if (!shouldMonitor) {
    if (compactAuthDialogTimer) clearInterval(compactAuthDialogTimer)
    compactAuthDialogTimer = undefined
    return
  }
  if (compactAuthDialogTimer) return

  compactAuthDialogTimer = setInterval(() => {
    const view = webViews.get('chatgpt')
    if (authDialogCheckInFlight || !view || view.webContents.isDestroyed()) return
    authDialogCheckInFlight = true
    void view.webContents.executeJavaScript(`(() => {
      const text = document.body?.innerText || '';
      const authDialog = /로그인\\s*또는\\s*회원가입|log\\s+in\\s+or\\s+sign\\s+up|sign\\s+in\\s+or\\s+sign\\s+up/i.test(text);
      const selectors = [
        '#prompt-textarea',
        '[data-testid="composer"] [contenteditable="true"]',
        '[data-testid="composer"] textarea',
        'form [contenteditable="true"]',
        'form textarea',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"][data-placeholder]',
        'textarea'
      ];
      const editor = selectors.map(selector => document.querySelector(selector)).find(element =>
        element instanceof HTMLElement
        && element.getClientRects().length > 0
        && !element.hasAttribute('disabled')
        && element.getAttribute('aria-hidden') !== 'true'
        && element.getAttribute('contenteditable') !== 'false'
      );
      if (!(editor instanceof HTMLElement)) return { authDialog, composerBottom: null, viewportHeight: window.innerHeight };
      const container = editor.closest('[data-testid="composer"]') || editor.closest('form') || editor;
      const bounds = container.getBoundingClientRect();
      return { authDialog, composerBottom: bounds.bottom, viewportHeight: window.innerHeight };
    })()`).then((result: { authDialog: boolean; composerBottom: number | null; viewportHeight: number }) => {
      if (!window || window.isDestroyed() || !window.isVisible() || settingsVisible
        || mode !== 'compact' || settings.activeProviderId !== 'chatgpt') return
      if (result.authDialog) {
        setMode('expanded')
        return
      }
      if (result.composerBottom === null) return
      const clippedBy = result.composerBottom + 16 - result.viewportHeight
      if (clippedBy >= 8) growCompactWindowForComposer(clippedBy * view.webContents.getZoomFactor())
    }).catch(() => undefined).finally(() => { authDialogCheckInFlight = false })
  }, 400)
  compactAuthDialogTimer.unref()
}

function growCompactWindowForComposer(requiredGrowth: number) {
  if (!window || window.isDestroyed() || mode !== 'compact') return
  const current = window.getBounds()
  const display = screen.getDisplayMatching(current)
  const area = display.workArea
  const maximumHeight = Math.min(320, area.height)
  const growth = Math.max(32, Math.ceil(requiredGrowth + 20))
  const height = Math.min(maximumHeight, current.height + growth)
  if (height <= current.height) return
  const bottom = Math.min(current.y + current.height, area.y + area.height)
  const y = Math.max(area.y, bottom - height)
  window.setBounds({ x: current.x, y, width: current.width, height }, true)
  settings.geometry = { ...settings.geometry, compact: { x: current.x, y, width: current.width, height } }
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, 'compact', String(display.id), { x: current.x, y, width: current.width, height })
  settingsStore.save(settings)
}

function savedBoundsForDisplay(targetMode: WindowMode, display: Electron.Display) {
  if (targetMode === 'fullscreen') return display.bounds
  const legacy = settings.geometry[targetMode]
  const byDisplay = settings.geometryByDisplay[targetMode]?.[String(display.id)]
  if (byDisplay) return legacy ? { ...byDisplay, width: legacy.width, height: legacy.height } : byDisplay
  if (!legacy) return undefined
  const legacyDisplay = screen.getDisplayNearestPoint({ x: legacy.x + legacy.width / 2, y: legacy.y + legacy.height / 2 })
  if (legacyDisplay.id === display.id) return legacy
  const area = display.workArea
  const fallback = lowerCenteredBounds(targetMode, area)
  return { ...fallback, width: legacy.width, height: legacy.height }
}

function positionWindowOnCursorDisplay() {
  if (!window || window.isDestroyed()) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const area = mode === 'fullscreen' ? display.bounds : display.workArea
  const savedBounds = savedBoundsForDisplay(mode, display)
  const bounds = mode === 'compact'
    ? lowerCenteredBounds(mode, area, savedBounds)
    : boundsForDisplay(mode, savedBounds, area)
  const minimum = minimumWindowSizes[mode]
  window.setMinimumSize(Math.min(minimum.width, area.width), Math.min(minimum.height, area.height))
  window.setBounds(bounds)
  settings.geometry = { ...settings.geometry, [mode]: bounds }
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, mode, String(display.id), bounds)
  settingsStore.save(settings)
}

function setMode(nextMode: WindowMode) {
  if (!window || window.isDestroyed() || mode === nextMode) return
  const oldBounds = window.getBounds()
  const currentCenter = { x: oldBounds.x + oldBounds.width / 2, y: oldBounds.y + oldBounds.height / 2 }
  const currentDisplay = screen.getDisplayNearestPoint(currentCenter)
  const savedBounds = savedBoundsForDisplay(nextMode, currentDisplay)
  const displayGeometry = geometryForCurrentDisplay(settings.geometry, nextMode, Boolean(savedBounds))
  displayGeometry[nextMode] = savedBounds
  const targetArea = nextMode === 'fullscreen' ? currentDisplay.bounds : currentDisplay.workArea
  const transition = transitionWindowGeometry(mode, oldBounds, nextMode, displayGeometry, targetArea, centeredBounds(nextMode, targetArea))
  const expandsCompact = mode === 'compact' && nextMode === 'expanded'
  const expandedBounds = {
    ...boundsForDisplay('expanded', savedBounds, targetArea),
    x: oldBounds.x
  }
  const result = expandsCompact
    ? { ...transition, bounds: boundsAnchoredAtBottom(oldBounds, expandedBounds, targetArea) }
    : transition
  result.geometry[nextMode] = result.bounds
  const started = performance.now()
  settings.geometry = result.geometry
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, mode, String(currentDisplay.id), oldBounds)
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, nextMode, String(currentDisplay.id), result.bounds)
  mode = result.mode
  syncCompactAuthDialogMonitor()
  const minimum = minimumWindowSizes[nextMode]
  window.setMinimumSize(Math.min(minimum.width, targetArea.width), Math.min(minimum.height, targetArea.height))
  window.setBounds(result.bounds, true)
  window.setAlwaysOnTop(settings.alwaysOnTop)
  settingsStore.save(settings)
  sendState()
  applyViewBounds()
  syncCompactWelcome()
  if (settings.activeProviderId === 'chatgpt') setTimeout(syncCompactWelcome, 300)
  recordPerformance(`window-${nextMode}-api-ms`, { duration: timeSince(started) })
}

function resetWindowToCompactDefaults() {
  if (!window || window.isDestroyed()) return
  const currentBounds = window.getBounds()
  const display = screen.getDisplayNearestPoint({ x: currentBounds.x + currentBounds.width / 2, y: currentBounds.y + currentBounds.height / 2 })
  const area = display.workArea
  const bounds = lowerCenteredBounds('compact', area)
  settings.geometry = { ...settings.geometry, compact: bounds }
  settings.geometryByDisplay = rememberDisplayBounds(settings.geometryByDisplay, 'compact', String(display.id), bounds)
  mode = 'compact'
  window.setMinimumSize(Math.min(minimumWindowSizes.compact.width, area.width), Math.min(minimumWindowSizes.compact.height, area.height))
  window.setBounds(bounds, true)
  applyViewBounds()
  syncCompactAuthDialogMonitor()
  settingsStore.save(settings)
}

function syncCompactWelcome() {
  const view = webViews.get('chatgpt')
  if (!view || view.webContents.isDestroyed()) return
  syncChatGptFixedFooter()
  const compact = mode === 'compact' && !hasChatGPTConversationRoute('chatgpt', view.webContents.getURL())
  void view.webContents.executeJavaScript(`
    (async () => {
      const styleId = 'just-chat-compact-welcome-style';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = 'html[data-just-chat-compact="true"] .just-chat-compact-welcome-suggestion { display: none !important; }';
        document.head.appendChild(style);
      }
      document.documentElement.dataset.justChatCompact = '${compact ? 'true' : 'false'}';
      const normalize = value => (value || '').trim().replace(/\\s+/g, ' ').replace(/[.!?。！？]+$/g, '');
      const suggestionTexts = new Set(['무엇을 할 수 있나요?', 'What can I do?']);
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const label = button => [button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-testid'), button.textContent]
          .filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim();
        const closeSidebar = buttons.find(button => /(?:close|collapse|hide).*sidebar|sidebar.*(?:close|collapse|hide)/i.test(label(button))
          || /(사이드바|탐색\\s*패널|메뉴).*(닫기|접기|숨기기)|(닫기|접기|숨기기).*(사이드바|탐색\\s*패널|메뉴)/.test(label(button))
          || /sidebar.*close/i.test(button.getAttribute('data-testid') || ''));
        const sidebarAlreadyClosed = buttons.some(button => /(?:open|expand|show).*sidebar|sidebar.*(?:open|expand|show)/i.test(label(button))
          || /(사이드바|탐색\\s*패널).*(열기|펼치기|보이기)/.test(label(button)));
        closeSidebar?.click();
        const sidebarHandled = Boolean(closeSidebar || sidebarAlreadyClosed);
        for (const button of document.querySelectorAll('button')) {
          if (suggestionTexts.has(normalize(button.textContent))) button.classList.add('just-chat-compact-welcome-suggestion');
        }
        if (sidebarHandled) return true;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      return false;
    })();
  `).catch(() => undefined)
}

function syncChatGptFixedFooter() {
  const view = webViews.get('chatgpt')
  if (!view || view.webContents.isDestroyed()) return
  void view.webContents.executeJavaScript(`(() => {
    const styleId = 'just-chat-disclaimer-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = '.just-chat-disclaimer-hidden { display: none !important; }';
      document.head.appendChild(style);
    }
    let hideDisclaimerScheduled = false;
    const hideDisclaimer = () => {
      hideDisclaimerScheduled = false;
      const candidates = Array.from(document.body.querySelectorAll('p, span, small')).filter(element => {
        if (element.classList.contains('just-chat-disclaimer-hidden')) return false;
        const text = (element.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length > 300) return false;
        if (element.querySelector('main, form, textarea, [contenteditable], [role="textbox"]')) return false;
        const koreanIntro = text.startsWith('ChatGPT는 AI입니다') && text.includes('동의하게 됩니다');
        const englishIntro = /^ChatGPT is an? AI\\b/i.test(text) && /\\bby using\\b/i.test(text);
        const koreanMistakeNotice = /^ChatGPT는 실수할 수 있습니다[.!。]?\\s*중요한 정보는 확인하세요[.!。]?$/i.test(text);
        const englishMistakeNotice = /^ChatGPT can make mistakes[.!]?\\s*check important info[.!]?$/i.test(text);
        return koreanIntro || englishIntro || koreanMistakeNotice || englishMistakeNotice;
      });
      candidates.sort((left, right) => left.textContent.length - right.textContent.length);
      candidates[0]?.classList.add('just-chat-disclaimer-hidden');
      const companyInfoLink = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]')).find(element => {
        if (element.classList.contains('just-chat-disclaimer-hidden')) return false;
        const label = (element.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!/^(회사\\s*정보|about(?: openai)?)$/i.test(label)) return false;
        return true;
      });
      companyInfoLink?.classList.add('just-chat-disclaimer-hidden');
    };
    const scheduleHideDisclaimer = () => {
      if (hideDisclaimerScheduled) return;
      hideDisclaimerScheduled = true;
      requestAnimationFrame(hideDisclaimer);
    };
    hideDisclaimer();
    if (!window.__justChatFixedFooterObserver) {
      window.__justChatFixedFooterObserver = new MutationObserver(scheduleHideDisclaimer);
      window.__justChatFixedFooterObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
    }
    return true;
  })()`).catch(() => undefined)
}

function syncBackgroundOpacity() {
  const view = webViews.get('chatgpt')
  if (!view || view.webContents.isDestroyed()) return
  const enabled = settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt'
  const alpha = Math.round(settings.backgroundOpacity * 100)
  void view.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const styleId = 'just-chat-background-opacity-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = \`
        html[data-just-chat-bg-opacity] body,
        html[data-just-chat-bg-opacity] #thread,
        html[data-just-chat-bg-opacity] #root { background-color: transparent !important; }
        html[data-just-chat-bg-opacity] .bg-token-main-surface-primary {
          background-color: color-mix(in srgb, var(--color-token-main-surface-primary) var(--just-chat-bg-alpha), transparent) !important;
        }
        html[data-just-chat-bg-opacity] .bg-token-bg-primary {
          background-color: color-mix(in srgb, var(--color-token-bg-primary) var(--just-chat-bg-alpha), transparent) !important;
        }
        html[data-just-chat-bg-opacity] .bg-token-bg-secondary {
          background-color: color-mix(in srgb, var(--color-token-bg-secondary) var(--just-chat-bg-alpha), transparent) !important;
        }
        html[data-just-chat-bg-opacity] .bg-token-bg-tertiary {
          background-color: color-mix(in srgb, var(--color-token-bg-tertiary) var(--just-chat-bg-alpha), transparent) !important;
        }
      \`;
      document.head.appendChild(style);
    }
    if (${enabled}) {
      root.style.setProperty('--just-chat-bg-alpha', '${alpha}%');
      root.dataset.justChatBgOpacity = 'true';
    } else {
      delete root.dataset.justChatBgOpacity;
      root.style.removeProperty('--just-chat-bg-alpha');
    }
    return true;
  })()`).catch(() => undefined)
}

function showChatView() {
  if (!settingsVisible) {
    const nextMode = modeForProviderPage(mode)
    if (nextMode !== mode) setMode(nextMode)
  }
  applyViewBounds()
  syncCompactAuthDialogMonitor()
}

function setProvider(id: ProviderId) {
  const selection = resolveProviderSelection(settings.activeProviderId, id)
  if (!selection?.changed) return
  const previousView = webViews.get(settings.activeProviderId)
  const started = performance.now()
  if (previousView && window && !window.isDestroyed()) window.contentView.removeChildView(previousView)
  settings.activeProviderId = selection.providerId
  syncCompactAuthDialogMonitor()
  window?.setBackgroundColor(effectiveWindowBackground())
  syncProviderViewBackgrounds()
  if (id === 'chatgpt') syncBackgroundOpacity()
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

function retryProvider() {
  const view = webViews.get(settings.activeProviderId)
  if (!view) return
  setProviderState(settings.activeProviderId, 'loading')
  void view.webContents.reload()
}

function focusChatView() {
  if (!window || window.isDestroyed() || settingsVisible) return
  window.focus()
  focusChatComposer()
}

function focusChatComposer() {
  if (!window || window.isDestroyed() || settingsVisible) return
  const view = webViews.get(settings.activeProviderId)
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.focus()
    void view.webContents.executeJavaScript(`
      (async () => {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const candidates = [
            document.querySelector('#prompt-textarea'),
            document.querySelector('[data-testid="composer"] [contenteditable="true"]'),
            document.querySelector('[data-testid="composer"] textarea'),
            document.querySelector('form [contenteditable="true"]'),
            document.querySelector('form textarea'),
            document.querySelector('[contenteditable="true"][role="textbox"]'),
            document.querySelector('[contenteditable="true"][data-placeholder]'),
            document.querySelector('textarea')
          ];
          const composer = candidates.find(element =>
            element instanceof HTMLElement
            && element.getClientRects().length > 0
            && !element.hasAttribute('disabled')
            && element.getAttribute('aria-hidden') !== 'true'
            && element.getAttribute('contenteditable') !== 'false'
          );
          if (composer instanceof HTMLElement) {
            composer.focus({ preventScroll: true });
            const bounds = composer.getBoundingClientRect();
            if (bounds.width > 0 && bounds.height > 0) {
              return {
                x: Math.round(bounds.left + Math.max(90, Math.min(140, bounds.width * 0.2))),
                y: Math.round(bounds.top + bounds.height / 2)
              };
            }
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return null;
      })();
    `).then((point: { x: number; y: number } | null) => {
      if (!point || view.webContents.isDestroyed()) return
      view.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left' })
      view.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left' })
    }).catch(() => undefined)
  }
}

function toggleWindow() {
  if (!window || window.isDestroyed()) {
    createWindow()
    return
  }
  if (window.isVisible()) {
    hideWindow()
    return
  }
  const activeView = webViews.get(settings.activeProviderId)
  const hasActiveChatGPTConversation = Boolean(
    activeView && !activeView.webContents.isDestroyed()
      && hasChatGPTConversationRoute(settings.activeProviderId, activeView.webContents.getURL())
  )
  const targetMode: WindowMode = hasActiveChatGPTConversation ? 'expanded' : 'compact'
  if (mode !== targetMode) setMode(targetMode)
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
  return globalShortcutBindings(candidate)
}

function validateSettingsShortcuts(candidate: AppSettings): string[] {
  return validateShortcutMap({
    toggle: candidate.shortcuts.toggle,
    'temporary-chat': candidate.shortcuts.temporaryChat,
    'toggle-size': candidate.shortcuts.toggleSize,
    'provider:chatgpt': candidate.shortcuts.providers.chatgpt,
    'provider:claude': candidate.shortcuts.providers.claude
  })
}

function shortcutCallbacks() {
  return Object.fromEntries([
    ['toggle', toggleWindow]
  ]) as Record<ShortcutName, () => void>
}

function replaceBindings(candidate: AppSettings): string[] {
  const validationFailures = validateSettingsShortcuts(candidate)
  if (validationFailures.length) return validationFailures
  const api = { register: (accelerator: string, callback: () => void) => globalShortcut.register(accelerator, callback), unregister: (accelerator: string) => globalShortcut.unregister(accelerator) }
  const result = replaceShortcutBindings(api, registeredShortcuts, desiredBindings(candidate), shortcutCallbacks())
  registeredShortcuts = result.registered
  return result.failed
}

function registerStartupBindings() {
  const api = { register: (accelerator: string, callback: () => void) => globalShortcut.register(accelerator, callback), unregister: (accelerator: string) => globalShortcut.unregister(accelerator) }
  shortcutFailures = validateSettingsShortcuts(settings)
  const attempt = registerShortcutBindings(api, desiredBindings(settings), shortcutCallbacks())
  registeredShortcuts = attempt.registered
  shortcutFailures = [...shortcutFailures, ...attempt.failed]
}

function isTrustedShell(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  if (!window || window.isDestroyed()) return false
  const frame = event.senderFrame
  if (!frame) return false
  return isTrustedShellSender(event.sender.id, shellContentsId, frame === event.sender.mainFrame, frame.url, shellDevelopmentOrigin, rendererFileUrl)
}

function applyWindowPreferences() {
  window?.setAlwaysOnTop(settings.alwaysOnTop)
  const selectiveBackground = settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt'
  window?.setOpacity(selectiveBackground ? 1 : settings.opacity)
  window?.setBackgroundColor(effectiveWindowBackground())
  syncProviderViewBackgrounds()
  syncBackgroundOpacity()
  scheduleSave()
  sendState()
}

function createWindow() {
  if (window && !window.isDestroyed()) return
  windowHasBeenFocused = false
  settingsVisible = false
  mode = settings.activeProviderId === 'chatgpt' && settings.lastChatGPTConversationPath ? 'expanded' : 'compact'
  modeBeforeFullscreen = mode
  const initialDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const workArea = initialDisplay.workArea
  const bounds = lowerCenteredBounds(mode, workArea, savedBoundsForDisplay(mode, initialDisplay))
  const minimum = minimumWindowSizes[mode]

  window = new BrowserWindow({
    ...bounds,
    minWidth: Math.min(minimum.width, workArea.width),
    minHeight: Math.min(minimum.height, workArea.height),
    show: false,
    frame: false,
    resizable: true,
    transparent: true,
    icon: appIconPath,
    alwaysOnTop: settings.alwaysOnTop,
    opacity: settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt' ? 1 : settings.opacity,
    backgroundColor: effectiveWindowBackground(),
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
    if (mode === 'compact' && Date.now() < suppressQuickChatBlurUntil) return
    if (!windowHasBeenFocused || !shouldAutoHideOnBlur()) return
    if (autoHideTimer) clearTimeout(autoHideTimer)
    autoHideTimer = setTimeout(() => {
      if (window && !window.isDestroyed() && !window.isModal() && window.isVisible() && shouldAutoHideOnBlur() && !window.isFocused()) {
        hideWindow()
      }
    }, 400)
  })
  window.on('focus', () => {
    windowHasBeenFocused = true
    if (autoHideTimer) clearTimeout(autoHideTimer)
    setTimeout(focusChatComposer, 100)
  })
  const appWindow = window
  appWindow.once('ready-to-show', () => {
    recordPerformance('cold-start-to-shell-ready-ms', { duration: timeSince(appStartTime), windowId: appWindow.id })
    showChatView()
    applyViewBounds()
    syncCompactWelcome()
    showWindow()
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

function shouldAutoHideOnBlur() {
  if (!windowHasBeenFocused) return false
  const view = webViews.get(settings.activeProviderId)
  return shouldHideWindowOnBlur({
    mode,
    autoHidePopover: settings.autoHidePopover,
    settingsVisible,
    providerId: settings.activeProviderId,
    providerUrl: view && !view.webContents.isDestroyed() ? view.webContents.getURL() : ''
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(appIconPath)
    if (!icon.isEmpty()) app.dock?.setIcon(icon)
  }
  startPerformanceSampler()
  settings = settingsStore.load()
  nativeTheme.themeSource = settings.theme
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
  if (compactAuthDialogTimer) clearInterval(compactAuthDialogTimer)
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
    opacity: typeof patch.opacity === 'number' ? patch.opacity : settings.opacity,
    theme: patch.theme === 'system' || patch.theme === 'dark' || patch.theme === 'light' ? patch.theme : settings.theme,
    opacityMode: patch.opacityMode === 'window' || patch.opacityMode === 'background' ? patch.opacityMode : settings.opacityMode,
    backgroundOpacity: typeof patch.backgroundOpacity === 'number' ? patch.backgroundOpacity : settings.backgroundOpacity,
    pageZoomPercent: typeof patch.pageZoomPercent === 'number' ? patch.pageZoomPercent : settings.pageZoomPercent,
    resetAfterMinutes: typeof patch.resetAfterMinutes === 'number' ? patch.resetAfterMinutes : settings.resetAfterMinutes,
    shortcuts: patch.shortcuts ? { ...settings.shortcuts, ...patch.shortcuts, providers: { ...settings.shortcuts.providers, ...patch.shortcuts.providers } } : settings.shortcuts
  }, process.platform)
  const failures = patch.shortcuts ? replaceBindings(candidate) : []
  if (failures.length) return { ok: false, failures }
  settings = candidate
  if (patch.theme) nativeTheme.themeSource = settings.theme
  if (typeof patch.pageZoomPercent === 'number') {
    for (const provider of providers) {
      const view = webViews.get(provider.id)
      if (view && !view.webContents.isDestroyed()) view.webContents.setZoomFactor(settings.pageZoomPercent / 100)
    }
  }
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
  settings.lastChatGPTConversationPath = undefined
  settingsStore.save(settings)

  if (settings.activeProviderId === 'chatgpt') {
    resetWindowToCompactDefaults()
    showChatView()
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
ipcMain.on('app:compact', (event) => { if (isTrustedShell(event)) setMode('compact') })
ipcMain.on('app:fullscreen', (event) => { if (isTrustedShell(event)) toggleFullscreen() })
ipcMain.on('app:hide', (event) => { if (isTrustedShell(event)) hideWindow() })
if (performanceEnabled) {
  ipcMain.handle('performance:toggle-window', (event) => {
    if (!isTrustedShell(event) || !window || window.isDestroyed()) throw new Error('untrusted or unavailable window')
    const currentWindow = window
    const targetEvent = currentWindow.isVisible() ? 'hide' : 'show'
    const started = performance.now()
    return new Promise<{ event: 'show' | 'hide'; durationMs: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (targetEvent === 'show') currentWindow.removeListener('show', onTransition)
        else currentWindow.removeListener('hide', onTransition)
        reject(new Error(`window did not emit ${targetEvent} within 2 seconds`))
      }, 2_000)
      const onTransition = () => {
        clearTimeout(timeout)
        resolve({ event: targetEvent, durationMs: timeSince(started) })
      }
      if (targetEvent === 'show') currentWindow.once('show', onTransition)
      else currentWindow.once('hide', onTransition)
      toggleWindow()
    })
  })
}
ipcMain.on('app:settings', (event, visible: boolean) => {
  if (!isTrustedShell(event)) return
  setSettingsVisibility(Boolean(visible))
})
ipcMain.on('app:provider', (event, id: ProviderId) => { if (isTrustedShell(event)) setProvider(id) })
ipcMain.on('app:retry-provider', (event) => { if (isTrustedShell(event)) retryProvider() })
