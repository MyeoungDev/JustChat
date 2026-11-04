import { useEffect, useState } from 'react'
import { acceleratorFromKeyChord, type AppSettings, type ShortcutName } from '../../shared/settings'
import type { ClearChatGptSessionResult } from '../../preload'

interface SettingsPanelProps {
  settings: AppSettings
  shortcutFailures: string[]
  platform: string
  onUpdate: (patch: Partial<Pick<AppSettings, 'shortcuts' | 'alwaysOnTop' | 'autoHidePopover' | 'escapeHidesPopover' | 'opacity' | 'resetAfterMinutes'>>) => Promise<{ ok: boolean; failures?: string[] }>
  onClearChatGptSession: () => Promise<ClearChatGptSessionResult>
  onClose: () => void
}

export function SettingsPanel({ settings, shortcutFailures, platform, onUpdate, onClearChatGptSession, onClose }: SettingsPanelProps) {
  const [capturing, setCapturing] = useState<ShortcutName | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null)

  useEffect(() => {
    if (opacityDraft === null || opacityDraft === settings.opacity) return
    const timer = window.setTimeout(() => {
      void update({ opacity: opacityDraft }).finally(() => setOpacityDraft(null))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [opacityDraft])

  async function update(patch: Parameters<typeof onUpdate>[0]) {
    setSaving(true)
    setMessage('')
    try {
      const result = await onUpdate(patch)
      setMessage(result.ok ? 'Saved' : 'That shortcut is unavailable. The previous shortcuts are still active.')
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
    else if (name === 'chat-history') void update({ shortcuts: { ...settings.shortcuts, chatHistory: accelerator } })
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
          <p>Keep the shell close to the way you work.</p>
        </div>
        <button className="icon-button" aria-label="Close settings" onClick={onClose}>×</button>
      </div>

      <div className="settings-content">
        <section className="settings-group" aria-labelledby="shortcut-heading">
          <h2 id="shortcut-heading">Keyboard</h2>
          <div className="setting-row"><div><strong>Show or hide Just Chat</strong><small>Global shortcut; works from any app.</small></div>{shortcutField('toggle', settings.shortcuts.toggle)}</div>
          <div className="setting-row"><div><strong>Search ChatGPT conversations</strong><small>Collapse to Pop Over first. Works while Just Chat is focused; other apps won’t capture it.</small></div>{shortcutField('chat-history', settings.shortcuts.chatHistory)}</div>
          {shortcutFailures.length > 0 && <p className="settings-note warning">Some default shortcuts could not be registered. Choose a different combination here.</p>}
        </section>

        <section className="settings-group" aria-labelledby="window-heading">
          <h2 id="window-heading">Window</h2>
          <label className="setting-row toggle-row"><span><strong>Always on top</strong><small>Keep the Just Chat window above other windows.</small></span><input type="checkbox" checked={settings.alwaysOnTop} disabled={saving} onChange={(event) => void update({ alwaysOnTop: event.target.checked })} /></label>
          <label className="setting-row toggle-row"><span><strong>Hide when focus moves away</strong><small>Useful for a quick Pop Over. Disable if it disappears while you work.</small></span><input type="checkbox" checked={settings.autoHidePopover} disabled={saving} onChange={(event) => void update({ autoHidePopover: event.target.checked })} /></label>
          <label className="setting-row toggle-row"><span><strong>Escape hides Just Chat</strong><small>When enabled, Escape hides the window in any size mode.</small></span><input type="checkbox" checked={settings.escapeHidesPopover} disabled={saving} onChange={(event) => void update({ escapeHidesPopover: event.target.checked })} /></label>
          <label className="setting-row opacity-row"><span><strong>Window opacity</strong><small>Applies to everything in the window, including ChatGPT text.</small></span><span className="range-control"><input aria-label="Window opacity" type="range" min="60" max="100" step="5" value={Math.round((opacityDraft ?? settings.opacity) * 100)} onChange={(event) => setOpacityDraft(event.currentTarget.valueAsNumber / 100)} /><output>{Math.round((opacityDraft ?? settings.opacity) * 100)}%</output></span></label>
          <label className="setting-row"><span><strong>Reset conversation after hiding</strong><small>Return to a fresh ChatGPT page after the window has been hidden.</small></span><select aria-label="Reset conversation after hiding" value={settings.resetAfterMinutes} disabled={saving} onChange={(event) => void update({ resetAfterMinutes: Number(event.target.value) })}><option value={0}>Never</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select></label>
        </section>

        <section className="settings-group" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Security &amp; Privacy</h2>
          <div className="setting-row">
            <div><strong>Sign out of ChatGPT in Just Chat</strong><small>Removes ChatGPT cookies and site data stored by Just Chat. It does not delete chats from your ChatGPT account or affect other apps.</small></div>
            {!confirmingClear && <button className="text-button" disabled={clearingSession} onClick={() => { setSessionMessage(''); setConfirmingClear(true) }}>Sign out…</button>}
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
