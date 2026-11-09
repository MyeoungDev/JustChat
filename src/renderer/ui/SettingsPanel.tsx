import { useEffect, useState, type CSSProperties } from 'react'
import { acceleratorFromKeyChord, defaultSettings, type AppSettings, type ShortcutName } from '../../shared/settings'
import type { ClearChatGptSessionResult } from '../../preload'

interface SettingsPanelProps {
  settings: AppSettings
  shortcutFailures: string[]
  platform: string
  onUpdate: (patch: Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'opacity' | 'theme' | 'opacityMode' | 'backgroundOpacity' | 'pageZoomPercent' | 'resetAfterMinutes'>>) => Promise<{ ok: boolean; failures?: string[] }>
  onClearChatGptSession: () => Promise<ClearChatGptSessionResult>
  onClose: () => void
}

export function SettingsPanel({ settings, shortcutFailures, platform, onUpdate, onClearChatGptSession, onClose }: SettingsPanelProps) {
  const [capturing, setCapturing] = useState<ShortcutName | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null)
  const [backgroundOpacityDraft, setBackgroundOpacityDraft] = useState<number | null>(null)
  const [pageZoomDraft, setPageZoomDraft] = useState<number | null>(null)
  const previewOpacity = settings.opacityMode === 'window'
    ? Math.round((opacityDraft ?? settings.opacity) * 100)
    : Math.round((backgroundOpacityDraft ?? settings.backgroundOpacity) * 100)
  const previewSurfaceOpacity = previewOpacity

  useEffect(() => {
    if (opacityDraft === null || opacityDraft === settings.opacity) return
    const timer = window.setTimeout(() => {
      void update({ opacity: opacityDraft }).finally(() => setOpacityDraft(null))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [opacityDraft])

  useEffect(() => {
    if (backgroundOpacityDraft === null || backgroundOpacityDraft === settings.backgroundOpacity) return
    const timer = window.setTimeout(() => {
      void update({ backgroundOpacity: backgroundOpacityDraft }).finally(() => setBackgroundOpacityDraft(null))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [backgroundOpacityDraft])

  useEffect(() => {
    if (pageZoomDraft === null || pageZoomDraft === settings.pageZoomPercent) return
    const timer = window.setTimeout(() => {
      void update({ pageZoomPercent: pageZoomDraft }).finally(() => setPageZoomDraft(null))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [pageZoomDraft])

  async function update(patch: Parameters<typeof onUpdate>[0]) {
    setSaving(true)
    setMessage('')
    try {
      const result = await onUpdate(patch)
      if (result.ok) setMessage('Saved')
      else if (result.failures?.some((failure) => failure.includes(':reserved:chatgpt-sidebar'))) {
        setMessage("Command+Shift+S is ChatGPT's sidebar shortcut. Choose a different combination.")
      } else if (result.failures?.some((failure) => failure.includes(':duplicate:'))) {
        setMessage('That combination is already used by another Just Chat shortcut. Choose a different one.')
      } else setMessage('That shortcut is unavailable. The previous shortcuts are still active.')
    } catch {
      setMessage('Could not save this setting.')
    } finally {
      setSaving(false)
    }
  }

  async function clearChatGptSession() {
    setClearingSession(true)
    setSessionMessage('')
    try {
      const result = await onClearChatGptSession()
      if (result.ok) setSessionMessage('ChatGPT sign-in data was removed. Close Settings to see the sign-in page.')
      else if (result.cleared) setSessionMessage('Sign-in data was removed, but ChatGPT could not reload. Close Settings and use Retry.')
      else setSessionMessage('Just Chat could not confirm that the ChatGPT data was removed. You can try again.')
      if (result.cleared) setConfirmingClear(false)
    } catch {
      setSessionMessage('Just Chat could not clear the ChatGPT sign-in data. You can try again.')
    } finally {
      setClearingSession(false)
    }
  }

  async function restoreDefaults() {
    const defaults = defaultSettings(platform)
    setOpacityDraft(null)
    setBackgroundOpacityDraft(null)
    setPageZoomDraft(null)
    setSaving(true)
    setMessage('')
    try {
      const result = await onUpdate({
        shortcuts: defaults.shortcuts,
        alwaysOnTop: defaults.alwaysOnTop,
        autoHidePopover: defaults.autoHidePopover,
        escapeHidesPopover: defaults.escapeHidesPopover,
        opacity: defaults.opacity,
        theme: defaults.theme,
        opacityMode: defaults.opacityMode,
        backgroundOpacity: defaults.backgroundOpacity,
        pageZoomPercent: defaults.pageZoomPercent,
        resetAfterMinutes: defaults.resetAfterMinutes
      })
      if (result.ok) {
        setConfirmingReset(false)
        setMessage('Settings restored to defaults.')
      } else {
        setMessage(result.failures?.length ? 'A default shortcut is unavailable. Previous settings are still active.' : 'Could not restore settings.')
      }
    } catch {
      setMessage('Could not restore settings.')
    } finally {
      setSaving(false)
    }
  }

  function capture(name: ShortcutName, event: React.KeyboardEvent<HTMLInputElement>) {
    event.preventDefault()
    if (event.key === 'Escape') {
      setCapturing(null)
      return
    }
    const accelerator = acceleratorFromKeyChord(event.nativeEvent, platform)
    if (!accelerator) return
    setCapturing(null)
    if (name === 'toggle') void update({ shortcuts: { ...settings.shortcuts, toggle: accelerator } })
    else if (name === 'temporary-chat') void update({ shortcuts: { ...settings.shortcuts, temporaryChat: accelerator } })
    else if (name === 'toggle-size') void update({ shortcuts: { ...settings.shortcuts, toggleSize: accelerator } })
    else if (name === 'toggle-fullscreen') void update({ shortcuts: { ...settings.shortcuts, toggleFullscreen: accelerator } })
    else {
      const provider = name.slice('provider:'.length) as 'chatgpt' | 'claude'
      void update({ shortcuts: { ...settings.shortcuts, providers: { ...settings.shortcuts.providers, [provider]: accelerator } } })
    }
  }

  function shortcutField(name: ShortcutName, value: string) {
    return (
      <input
        className={`shortcut-input ${capturing === name ? 'capturing' : ''}`}
        aria-label={`${name} shortcut`}
        value={capturing === name ? 'Press a shortcut…' : value}
        readOnly
        onFocus={() => setCapturing(name)}
        onBlur={() => { if (capturing === name) setCapturing(null) }}
        onKeyDown={(event) => { if (capturing === name) capture(name, event) }}
        onClick={() => setCapturing(name)}
      />
    )
  }

  return (
    <section className="settings-panel" aria-label="Settings">
      <div className="settings-heading">
        <div>
          <h1>Settings</h1>
        </div>
        <button className="icon-button" aria-label="Close settings" onClick={onClose}>×</button>
      </div>

      <div className="settings-content">
        <section className="settings-group" aria-labelledby="shortcut-heading">
          <h2 id="shortcut-heading">Keyboard</h2>
          <div className="setting-row"><div><strong>Open or close Settings</strong><small>Only while Just Chat is focused.</small></div><kbd className="shortcut-hint">{platform === 'darwin' ? '⌘,' : 'Ctrl+,'}</kbd></div>
          <div className="setting-row"><div><strong>Show or hide Just Chat</strong><small>Global shortcut; works from any app.</small></div>{shortcutField('toggle', settings.shortcuts.toggle)}</div>
          <div className="setting-row"><div><strong>Grow or shrink the window</strong><small>Only while Just Chat is focused in Compact or Expanded mode; it is not registered globally.</small></div>{shortcutField('toggle-size', settings.shortcuts.toggleSize)}</div>
          <div className="setting-row"><div><strong>Toggle full screen</strong><small>Only while Just Chat is focused; it is not registered globally.</small></div>{shortcutField('toggle-fullscreen', settings.shortcuts.toggleFullscreen)}</div>
          <div className="setting-row"><div><strong>Start a temporary ChatGPT chat</strong><small>Only while Just Chat is focused. Opens a new chat first when you are already in a conversation.</small></div>{shortcutField('temporary-chat', settings.shortcuts.temporaryChat)}</div>
          {shortcutFailures.length > 0 && <p className="settings-note warning">Some default shortcuts could not be registered. Choose a different combination here.</p>}
        </section>

        <section className="settings-group" aria-labelledby="window-heading">
          <h2 id="window-heading">Window</h2>
          <label className="setting-row"><span><strong>Theme</strong><small>Follows your system appearance by default.</small></span><select aria-label="Theme" value={settings.theme} disabled={saving} onChange={(event) => void update({ theme: event.target.value as AppSettings['theme'] })}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label className="setting-row opacity-row"><span><strong>ChatGPT page zoom</strong><small>100% is the current full-size ChatGPT view. Adjust this setting to change it.</small></span><span className="range-control"><input aria-label="ChatGPT page zoom" type="range" min="70" max="120" step="1" value={pageZoomDraft ?? settings.pageZoomPercent} disabled={saving} onChange={(event) => setPageZoomDraft(event.currentTarget.valueAsNumber)} /><output>{pageZoomDraft ?? settings.pageZoomPercent}%</output></span></label>
          <label className="setting-row toggle-row"><span><strong>Always on top</strong><small>Keep the Just Chat window above other windows.</small></span><input type="checkbox" checked={settings.alwaysOnTop} disabled={saving} onChange={(event) => void update({ alwaysOnTop: event.target.checked })} /></label>
          <label className="setting-row toggle-row"><span><strong>Also hide Pop Over when focus moves away</strong><small>Empty Quick Chat closes automatically; this option applies to Pop Over.</small></span><input type="checkbox" checked={settings.autoHidePopover} disabled={saving} onChange={(event) => void update({ autoHidePopover: event.target.checked })} /></label>
          <label className="setting-row toggle-row"><span><strong>Escape hides Just Chat</strong><small>When enabled, Escape hides the window in any size mode.</small></span><input type="checkbox" checked={settings.escapeHidesPopover} disabled={saving} onChange={(event) => void update({ escapeHidesPopover: event.target.checked })} /></label>
          <label className="setting-row"><span><strong>Transparency mode</strong><small>Background only changes the opacity of ChatGPT surfaces. Text and controls stay opaque.</small></span><select aria-label="Transparency mode" value={settings.opacityMode} disabled={saving} onChange={(event) => void update({ opacityMode: event.target.value as AppSettings['opacityMode'] })}><option value="window">Whole window</option><option value="background">Background only (Experimental)</option></select></label>
          {settings.opacityMode === 'window' ? <label className="setting-row opacity-row"><span><strong>Window opacity</strong><small>Applies to everything in the window, including ChatGPT text.</small></span><span className="range-control"><input aria-label="Window opacity" type="range" min="60" max="100" step="5" value={Math.round((opacityDraft ?? settings.opacity) * 100)} onChange={(event) => setOpacityDraft(event.currentTarget.valueAsNumber / 100)} /><output>{Math.round((opacityDraft ?? settings.opacity) * 100)}%</output></span></label> : <label className="setting-row opacity-row"><span><strong>ChatGPT background opacity</strong><small>100% is fully opaque. Lower values make backgrounds more transparent; text and controls stay opaque.</small></span><span className="range-control"><input aria-label="ChatGPT background opacity" type="range" min="70" max="100" step="10" value={Math.round((backgroundOpacityDraft ?? settings.backgroundOpacity) * 100)} onChange={(event) => setBackgroundOpacityDraft(event.currentTarget.valueAsNumber / 100)} /><output>{Math.round((backgroundOpacityDraft ?? settings.backgroundOpacity) * 100)}%</output></span></label>}
          <div className="opacity-preview" aria-label="Transparency preview">
            <div className="opacity-preview-caption">Preview · {settings.opacityMode === 'window' ? `${previewOpacity}% whole window` : `${previewOpacity}% background, conversation and composer`}</div>
            <div className={`opacity-preview-window ${settings.theme === 'dark' ? 'theme-dark' : settings.theme === 'light' ? 'theme-light' : 'theme-system'} ${settings.opacityMode === 'window' ? 'whole-window' : 'background-only'}`} style={{ opacity: settings.opacityMode === 'window' ? previewOpacity / 100 : 1, '--preview-bg-alpha': `${previewOpacity}%`, '--preview-surface-alpha': `${previewSurfaceOpacity}%` } as CSSProperties}>
              <div className="opacity-preview-topbar"><span className="opacity-preview-dot" /><span>ChatGPT</span></div>
              <div className="opacity-preview-chat">
                <div className="opacity-preview-user">이 내용을 간단히 설명해줘</div>
                <p>핵심 내용을 정리해 답변합니다. 글자 색은 그대로 유지됩니다.</p>
                <div className="opacity-preview-composer">ChatGPT에게 물어보세요 <span>↑</span></div>
              </div>
            </div>
          </div>
          <label className="setting-row"><span><strong>Reset conversation after hiding</strong><small>Starts a fresh ChatGPT page next time if Just Chat stays hidden for this long.</small></span><select aria-label="Reset conversation after hiding" value={settings.resetAfterMinutes} disabled={saving} onChange={(event) => void update({ resetAfterMinutes: Number(event.target.value) })}><option value={0}>Never</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select></label>
          <div className="setting-row">
            <div><strong>Restore settings to defaults</strong><small>Resets shortcuts, appearance, zoom, transparency and window behavior. Window size, ChatGPT sign-in and chats are kept.</small></div>
            {!confirmingReset && <button className="text-button" disabled={saving} onClick={() => setConfirmingReset(true)}>Restore defaults…</button>}
          </div>
          {confirmingReset && <div className="session-clear-confirm" role="group" aria-label="Confirm restoring settings">
            <p>Restore all configurable settings to their defaults? Your window size and ChatGPT data will remain.</p>
            <div className="session-clear-actions">
              <button className="text-button" disabled={saving} onClick={() => setConfirmingReset(false)}>Cancel</button>
              <button className="text-button" disabled={saving} onClick={() => void restoreDefaults()}>{saving ? 'Restoring…' : 'Restore defaults'}</button>
            </div>
          </div>}
        </section>

        <section className="settings-group" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Security &amp; Privacy</h2>
          <div className="setting-row">
            <div><strong>Sign out of ChatGPT in Just Chat</strong><small>Removes ChatGPT cookies and site data stored by Just Chat. It does not delete chats from your ChatGPT account or affect other apps.</small></div>
            {!confirmingClear && <button className="signout-button" disabled={clearingSession} onClick={() => { setSessionMessage(''); setConfirmingClear(true) }}>Sign out…</button>}
          </div>
          {confirmingClear && <div className="session-clear-confirm" role="group" aria-label="Confirm ChatGPT sign out">
            <p>This will sign you out of ChatGPT in Just Chat and remove its local website data. Your account conversations and downloaded files will remain.</p>
            <div className="session-clear-actions">
              <button className="text-button" disabled={clearingSession} onClick={() => setConfirmingClear(false)}>Cancel</button>
              <button className="text-button danger-button" disabled={clearingSession} onClick={() => void clearChatGptSession()}>{clearingSession ? 'Signing out…' : 'Sign out and clear data'}</button>
            </div>
          </div>}
          {sessionMessage && <p className="session-clear-message" role="status">{sessionMessage}</p>}
        </section>
        <div className="settings-footer" role="status">{message || (saving ? 'Saving…' : '')}</div>
      </div>
    </section>
  )
}
