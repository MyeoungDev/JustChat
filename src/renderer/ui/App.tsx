import { useEffect, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { AppSettings } from '../../shared/settings'
import type { ShellState } from '../../preload'
import { SettingsPanel } from './SettingsPanel'
import './styles.css'

const initialSettings: AppSettings = {
  activeProviderId: 'chatgpt',
  shortcuts: { toggle: '', temporaryChat: '', chatHistory: '', providers: {} },
  alwaysOnTop: true,
  autoHidePopover: false,
  escapeHidesPopover: true,
  resetAfterMinutes: 30,
  geometry: {}
}

export function App() {
  const [state, setState] = useState<ShellState | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [shortcutFailures, setShortcutFailures] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [notice, setNotice] = useState('')

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

  async function sendPrompt(event: FormEvent | ReactKeyboardEvent<HTMLTextAreaElement>) {
    event.preventDefault()
    if (!prompt.trim() || sending) return
    setSending(true)
    setFeedback('ChatGPT에 연결하고 있어요…')
    const result = await window.justChat.submitPrompt(prompt)
    setSending(false)
    if (result.ok) {
      setPrompt('')
      setFeedback('')
      setNotice('')
      return
    }
    setFeedback('ChatGPT 입력창에 내용을 자동으로 전달하지 못했어요. 초안은 그대로 보존했습니다.')
  }

  async function openInChatGPT() {
    if (!prompt.trim()) return
    const result = await window.justChat.openChatManually(prompt)
    if (!result.ok) {
      setFeedback('ChatGPT 화면을 여는 데 실패했어요. 입력한 내용은 보존했습니다.')
      return
    }
    setPrompt('')
    setFeedback('')
    setNotice('초안을 클립보드에 복사했어요. ChatGPT 입력창에 붙여 넣으세요.')
  }

  function onPromptKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void sendPrompt(event)
    }
  }

  return (
    <>
      <header className="shell-header">
        <div className="brand-row">
          <div className="window-actions">
            {state?.chatViewVisible && <button className="back-to-composer" onClick={() => { setNotice(''); window.justChat.showComposer() }}>새 대화</button>}
            <button className="icon-button" aria-label={state?.mode === 'expanded' ? 'Collapse window' : state?.mode === 'fullscreen' ? 'Return to expanded window' : 'Expand window'} title={state?.mode === 'expanded' ? 'Collapse' : state?.mode === 'fullscreen' ? 'Expanded' : 'Expand'} onClick={() => state?.mode === 'expanded' ? window.justChat.collapse() : window.justChat.expand()}>
              {state?.mode === 'expanded' ? '↙' : '↗'}
            </button>
            <button className="icon-button" aria-label={state?.mode === 'fullscreen' ? 'Exit full screen' : 'Fill current display'} title={state?.mode === 'fullscreen' ? 'Exit full screen' : 'Full screen'} onClick={() => window.justChat.toggleFullscreen()}>
              {state?.mode === 'fullscreen' ? '⤢' : '⛶'}
            </button>
            <button className={`icon-button ${state?.settingsVisible ? 'selected' : ''}`} aria-label={state?.settingsVisible ? 'Close settings' : 'Open settings'} title="Settings" onClick={() => window.justChat.showSettings(!state?.settingsVisible)}>⚙</button>
            <button className="icon-button hide-button" aria-label="Hide window" title="Hide" onClick={() => window.justChat.hide()}>×</button>
          </div>
        </div>
      </header>

      {state?.settingsVisible ? (
        <SettingsPanel
          settings={settings}
          shortcutFailures={shortcutFailures}
          platform={window.justChat.platform}
          onUpdate={updateSettings}
          onClearChatGptSession={() => window.justChat.clearChatGptSession()}
          onClose={() => window.justChat.showSettings(false)}
        />
      ) : state?.chatViewVisible ? (
        notice ? <aside className="shell-notice" role="status">{notice}</aside> : null
      ) : (
        <main className="composer-shell">
          <form className="composer" onSubmit={(event) => void sendPrompt(event)}>
            <textarea
              aria-label="ChatGPT에 보낼 메시지"
              placeholder="무엇이든 물어보세요"
              value={prompt}
              maxLength={50_000}
              disabled={sending}
              onChange={(event) => { setPrompt(event.target.value); setFeedback('') }}
              onKeyDown={onPromptKeyDown}
              autoFocus
            />
            <div className="composer-footer">
              <div className="composer-provider"><span className="provider-dot" />ChatGPT <span>웹으로 전송</span></div>
              <button className="send-button" aria-label="ChatGPT에 보내기" disabled={!prompt.trim() || sending} type="submit">
                {sending ? <span className="loading-dot" /> : '↑'}
              </button>
            </div>
          </form>
          {feedback && <div className="composer-feedback" role="status">
            <span>{feedback}</span>
            {!sending && prompt.trim() && <button className="text-button" onClick={() => void openInChatGPT()}>ChatGPT 화면 열기</button>}
          </div>}
          {state?.providerState === 'error' && <div className="provider-error"><span>ChatGPT 연결 상태를 확인할 수 없습니다.</span><button className="text-button" onClick={() => window.justChat.retryProvider()}>다시 시도</button></div>}
          <div className="composer-hint">Enter 전송 · Shift+Enter 줄바꿈</div>
        </main>
      )}
    </>
  )
}
