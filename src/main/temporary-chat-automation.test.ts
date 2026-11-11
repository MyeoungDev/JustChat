import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { temporaryChatAutomationScript } from './temporary-chat-automation'

type ControlOptions = {
  label: string
  visible?: boolean
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

class MockElement {
  isConnected = true
  disabled: boolean
  innerText: string
  textContent: string
  private readonly attrs = new Map<string, string>()
  private readonly onClick?: () => void

  constructor({ label, visible = true, selected, disabled = false, onClick }: ControlOptions) {
    this.innerText = label
    this.textContent = label
    this.disabled = disabled
    this.onClick = onClick
    this.attrs.set('aria-label', label)
    if (selected !== undefined) this.attrs.set('aria-pressed', String(selected))
    this.visible = visible
  }

  visible: boolean

  getClientRects() {
    return this.visible ? [{}] : []
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value)
  }

  click() {
    this.onClick?.()
  }

  focus() {
    mockDocument.activeElement = this
  }

  contains(element: unknown) {
    return element === this
  }
}

let mockDocument: {
  activeElement: MockElement | null
  querySelectorAll: (selector: string) => MockElement[]
}

async function runAutomation(options: {
  workMode?: boolean
  temporary?: boolean
  includeNewChat?: boolean
  newChatVisible?: boolean
  userMessages?: number
} = {}) {
  let currentUrl = 'https://chatgpt.com/'
  let sidebarOpened = false
  let userMessageCount = options.userMessages ?? 0
  const chat = new MockElement({ label: 'Chat', selected: !options.workMode, onClick: () => {
    chat.setAttribute('aria-pressed', 'true')
    work.setAttribute('aria-pressed', 'false')
  } })
  const work = new MockElement({ label: 'Work', selected: Boolean(options.workMode) })
  const temporary = new MockElement({ label: options.temporary ? 'Turn off Temporary Chat' : 'Temporary Chat', selected: options.temporary, onClick: () => {
    temporary.setAttribute('aria-label', options.temporary ? 'Temporary Chat' : 'Turn off Temporary Chat')
    temporary.setAttribute('aria-pressed', String(!options.temporary))
    options.temporary = !options.temporary
    currentUrl = options.temporary ? `${currentUrl}?temporary-chat=true` : 'https://chatgpt.com/'
  } })
  const sidebar = new MockElement({ label: 'Open sidebar', onClick: () => { sidebarOpened = true } })
  const newChat = new MockElement({ label: 'New chat', visible: options.newChatVisible ?? true, onClick: () => {
    currentUrl = 'https://chatgpt.com/?temporary-chat=true&new=1'
    userMessageCount = 0
  } })
  const composer = new MockElement({ label: 'Message ChatGPT' })
  const controls = [chat, work, temporary, sidebar, ...(options.includeNewChat === false ? [] : [newChat])]
  mockDocument = {
    activeElement: null,
    querySelectorAll(selector) {
      if (selector.includes('[data-message-author-role="user"]')) return Array.from({ length: userMessageCount }, () => new MockElement({ label: 'user message' }))
      if (selector.includes('#prompt-textarea')) return [composer]
      return controls
    }
  }
  const HTMLElement = MockElement
  const location = { get href() { return currentUrl } }
  const result = await runInNewContext(temporaryChatAutomationScript, {
    document: mockDocument,
    HTMLElement,
    location,
    URL,
    Date,
    setTimeout: (callback: () => void) => { callback(); return 0 },
    Promise
  })
  return { result, sidebarOpened, chat, work }
}

describe('temporary ChatGPT shortcut automation', () => {
  it('switches from Work to Chat before starting a temporary chat', async () => {
    const { result, chat, work, sidebarOpened } = await runAutomation({ workMode: true })

    expect(result).toMatchObject({
      code: 'temporary-chat-started',
      chatMode: true,
      temporary: true,
      composerFocused: true,
      sidebarOpened: false
    })
    expect(chat.getAttribute('aria-pressed')).toBe('true')
    expect(work.getAttribute('aria-pressed')).toBe('false')
    expect(sidebarOpened).toBe(false)
  })

  it('starts a new temporary chat from an existing temporary chat without opening the sidebar', async () => {
    const { result, sidebarOpened } = await runAutomation({ temporary: true, userMessages: 1, newChatVisible: false })

    expect(result).toMatchObject({
      code: 'new-temporary-chat',
      chatMode: true,
      temporary: true,
      composerFocused: true,
      sidebarOpened: false
    })
    expect(sidebarOpened).toBe(false)
  })

  it('fails safely when the new-chat control is missing', async () => {
    const { result, sidebarOpened } = await runAutomation({ temporary: true, includeNewChat: false })

    expect(result).toMatchObject({ code: 'new-chat-control-unavailable', temporary: true, composerFocused: false })
    expect(sidebarOpened).toBe(false)
  })
})
