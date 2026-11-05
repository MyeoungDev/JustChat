import { useEffect, useState } from 'react'
import type { AppSettings } from '../../shared/settings'
import type { ShellState } from '../../preload'
import { SettingsPanel } from './SettingsPanel'
import './styles.css'

const initialSettings: AppSettings = {
  activeProviderId: 'chatgpt',
  shortcuts: { toggle: '', chatHistory: '', providers: {} },
  alwaysOnTop: true,
  autoHidePopover: false,
  escapeHidesPopover: true,
  opacity: 1,
  resetAfterMinutes: 30,
  geometry: {},
  geometryByDisplay: {}
}

export function App() {
  const [state, setState] = useState<ShellState | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [shortcutFailures, setShortcutFailures] = useState<string[]>([])

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

  async function updateSettings(patch: Parameters<typeof window.justChat.updateSettings>[0]) {
    const result = await window.justChat.updateSettings(patch)
    if (result.ok && result.settings) setSettings(result.settings)
    return result
  }

  return (
    <>
      <header className="shell-header">
        <div className="brand-row">
          <div className="window-actions">
            <button className={`icon-button size-button ${state?.mode === 'expanded' ? 'selected' : ''}`} aria-label={state?.mode === 'expanded' ? 'Switch to Quick Chat' : 'Expand chat'} aria-pressed={state?.mode === 'expanded'} title={state?.mode === 'expanded' ? 'Quick Chat · 520 × 200' : 'Expand chat · 520 × 480'} onClick={() => state?.mode === 'expanded' ? window.justChat.compact() : window.justChat.expand()}>
              {state?.mode === 'expanded'
                ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3v4H3M13 3v4h4M3 13h4v4M17 13h-4v4"/><rect x="6" y="6" width="8" height="8" rx="1"/></svg>
                : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V4h4M13 4h4v4M17 12v4h-4M7 16H3v-4"/><rect x="6.5" y="7" width="7" height="6" rx="1"/></svg>}
            </button>
            <button className="icon-button" aria-label={state?.mode === 'fullscreen' ? 'Exit full screen' : 'Fill current display'} title={state?.mode === 'fullscreen' ? 'Exit full screen' : 'Full screen'} onClick={() => window.justChat.toggleFullscreen()}>
              {state?.mode === 'fullscreen' ? '⤢' : '⛶'}
            </button>
            <button className={`icon-button ${state?.settingsVisible ? 'selected' : ''}`} aria-label={state?.settingsVisible ? 'Close settings' : 'Open settings'} title="Settings" onClick={() => window.justChat.showSettings(!state?.settingsVisible)}>⚙</button>
            <button className="icon-button hide-button" aria-label="Hide window" title="Hide" onClick={() => window.justChat.hide()}>×</button>
          </div>
        </div>
      </header>

      {state?.settingsVisible && (
        <SettingsPanel
          settings={settings}
          shortcutFailures={shortcutFailures}
          platform={window.justChat.platform}
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
