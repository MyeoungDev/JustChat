import { useEffect, useState } from 'react'
import type { AppSettings } from '../../shared/settings'
import type { ShellState } from '../../preload'
import { acceleratorFromKeyChord } from '../../shared/settings'
import { SettingsPanel } from './SettingsPanel'
import './styles.css'

const initialSettings: AppSettings = {
  activeProviderId: 'chatgpt',
  shortcuts: { toggle: '', temporaryChat: '', toggleSize: '', toggleFullscreen: '', providers: {} },
  alwaysOnTop: true,
  autoHidePopover: false,
  escapeHidesPopover: true,
  opacity: 1,
  theme: 'system',
  opacityMode: 'window',
  backgroundOpacity: 0.9,
  pageZoomPercent: 100,
  pageZoomScaleVersion: 3,
  notifyWhenChatGPTCompletesWhileHidden: true,
  resetAfterMinutes: 30,
  geometry: {},
  geometryByDisplay: {}
}

function displayShortcut(accelerator: string, platform: string) {
  if (platform === 'darwin') {
    return accelerator
      .replaceAll('Command', '⌘')
      .replaceAll('Control', '⌃')
      .replaceAll('Alt', '⌥')
      .replaceAll('Shift', '⇧')
      .replaceAll('+', '')
  }
  return accelerator
    .replaceAll('CommandOrControl', 'Ctrl')
    .replaceAll('Command', 'Ctrl')
    .replaceAll('Control', 'Ctrl')
    .replaceAll('Super', 'Win')
}

export function App() {
  const [state, setState] = useState<ShellState | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [shortcutFailures, setShortcutFailures] = useState<string[]>([])
  const platform = window.justChat.platform
  const sizeShortcut = displayShortcut(settings.shortcuts.toggleSize, platform)
  const fullscreenShortcut = displayShortcut(settings.shortcuts.toggleFullscreen, platform)
  const settingsShortcut = displayShortcut(platform === 'darwin' ? 'Command+,' : 'Control+,', platform)
  const hideShortcut = displayShortcut(platform === 'darwin' ? 'Command+W' : settings.shortcuts.toggle, platform)
  const toggleShortcut = displayShortcut(settings.shortcuts.toggle, platform)

  useEffect(() => {
    let mounted = true
    const unsubscribe = window.justChat.onState((next) => {
      setState(next)
      setSettings(next.settings)
      setShortcutFailures(next.shortcutFailures)
    })
    void window.justChat.getState().then((initial) => {
      if (!mounted || !initial) return
      setState(initial)
      setSettings(initial.settings)
      setShortcutFailures(initial.shortcutFailures)
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  useEffect(() => {
    const selective = settings.opacityMode === 'background' && settings.activeProviderId === 'chatgpt'
    document.body.dataset.backgroundOpacity = selective ? 'true' : 'false'
  }, [settings.opacityMode, settings.activeProviderId])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.style.colorScheme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const editing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'))
      if (editing && event.key !== 'Escape') return
      const zoomModifier = platform === 'darwin' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
      const zoomKey = ['Digit0', 'Numpad0', 'Minus', 'NumpadSubtract', 'Equal', 'NumpadAdd'].includes(event.code)
        || ['-', '_', '+', '='].includes(event.key)
      if (zoomModifier && !event.altKey && zoomKey) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const chord = event.key === 'Escape' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        ? 'Escape'
        : acceleratorFromKeyChord({ key: event.code === 'Comma' ? 'Comma' : event.code === 'Period' ? 'Period' : event.key, code: event.code, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey }, platform)
      if (!chord) return
      const settingsBinding = platform === 'darwin' ? 'Command+Comma' : 'Control+Comma'
      const bindings = [settingsBinding, 'Escape',
        settings.shortcuts.toggleSize, settings.shortcuts.toggleFullscreen, settings.shortcuts.temporaryChat]
      if (!bindings.includes(chord)) return
      if (chord === 'Escape' && !state?.settingsVisible && state?.mode !== 'fullscreen' && !settings.escapeHidesPopover) return
      event.preventDefault()
      event.stopPropagation()
      void window.justChat.dispatchShortcut(chord)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [platform, settings.escapeHidesPopover, settings.shortcuts.toggleSize, settings.shortcuts.toggleFullscreen, settings.shortcuts.temporaryChat, state?.settingsVisible, state?.mode])

  async function updateSettings(patch: Parameters<typeof window.justChat.updateSettings>[0]) {
    const result = await window.justChat.updateSettings(patch)
    if (result.ok && result.settings) setSettings(result.settings)
    return result
  }

  return (
    <>
      <header className="shell-header" onMouseDown={(event) => {
        if (event.button === 0 && !(event.target as HTMLElement).closest('button')) window.justChat.startDragging?.()
      }}>
        <div className="brand-row">
          <div className="window-actions">
            <button className={`icon-button size-button ${state?.mode === 'expanded' ? 'selected' : ''}`} aria-label={state?.mode === 'expanded' ? `Switch to Quick Chat, ${sizeShortcut}` : `Expand chat, ${sizeShortcut}`} aria-describedby="size-action-tooltip" aria-pressed={state?.mode === 'expanded'} onClick={() => state?.mode === 'expanded' ? window.justChat.compact() : window.justChat.expand()}>
              {state?.mode === 'expanded'
                ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3v4H3M13 3v4h4M3 13h4v4M17 13h-4v4"/><rect x="6" y="6" width="8" height="8" rx="1"/></svg>
                : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V4h4M13 4h4v4M17 12v4h-4M7 16H3v-4"/><rect x="6.5" y="7" width="7" height="6" rx="1"/></svg>}
              <span className="toolbar-tooltip" id="size-action-tooltip" role="tooltip"><span>{state?.mode === 'expanded' ? 'Shrink to Quick Chat' : 'Expand chat'}</span><kbd>{sizeShortcut}</kbd></span>
            </button>
            <button className="icon-button" aria-label={`${state?.mode === 'fullscreen' ? 'Exit full screen' : 'Fill current display'}, ${fullscreenShortcut}`} aria-describedby="fullscreen-action-tooltip" onClick={() => window.justChat.toggleFullscreen()}>
              {state?.mode === 'fullscreen' ? '⤢' : '⛶'}
              <span className="toolbar-tooltip" id="fullscreen-action-tooltip" role="tooltip"><span>{state?.mode === 'fullscreen' ? 'Exit full screen' : 'Full screen'}</span><kbd>{fullscreenShortcut}</kbd></span>
            </button>
            <button className={`icon-button ${state?.settingsVisible ? 'selected' : ''}`} aria-label={`${state?.settingsVisible ? 'Close settings' : 'Open settings'}, ${settingsShortcut}`} aria-describedby="settings-action-tooltip" onClick={() => window.justChat.showSettings(!state?.settingsVisible)}>⚙<span className="toolbar-tooltip" id="settings-action-tooltip" role="tooltip"><span>Settings</span><kbd>{settingsShortcut}</kbd></span></button>
            <button className="icon-button hide-button" aria-label={`Hide window, ${hideShortcut}${platform === 'darwin' ? ` or ${toggleShortcut}` : ''}`} aria-describedby="hide-action-tooltip" onClick={() => window.justChat.hide()}>×<span className="toolbar-tooltip" id="hide-action-tooltip" role="tooltip"><span>Hide window</span><kbd>{hideShortcut}</kbd>{platform === 'darwin' && <kbd>{toggleShortcut}</kbd>}</span></button>
          </div>
        </div>
      </header>

      {state?.settingsVisible && (
        <SettingsPanel
          settings={settings}
          shortcutFailures={shortcutFailures}
          platform={platform}
          onUpdate={updateSettings}
          onClearChatGptSession={() => window.justChat.clearChatGptSession()}
          onClose={() => window.justChat.showSettings(false)}
        />
      )}
      {!state?.settingsVisible && state?.providerState === 'error' && (
        <aside className="provider-state" role="alert">
          <div>
            <h1>ChatGPT could not load</h1>
            <p>Check your connection or try again.</p>
          </div>
          <button className="primary-button" onClick={() => window.justChat.retryProvider()}>Retry</button>
        </aside>
      )}
    </>
  )
}
