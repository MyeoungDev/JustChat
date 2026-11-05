import { describe, expect, it } from 'vitest'
import { hasChatGPTConversationRoute, isChatGPTSendKey, shouldHideWindowOnBlur } from './window-behavior'

describe('compact chat growth signals', () => {
  it('recognizes an unmodified Enter send key without inspecting page content', () => {
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter' })).toBe(true)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', shift: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', isComposing: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', isAutoRepeat: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyUp', key: 'Enter' })).toBe(false)
  })
})

describe('window blur behavior', () => {
  it('recognizes regular ChatGPT conversation routes without inspecting page content', () => {
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/c/abc123')).toBe(true)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/g/gpt-name/c/abc123')).toBe(true)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/')).toBe(false)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/?temporary-chat=true')).toBe(false)
    expect(hasChatGPTConversationRoute('claude', 'https://chatgpt.com/c/abc123')).toBe(false)
  })

  it('dismisses an empty compact ChatGPT page but keeps a routed conversation open', () => {
    const context = {
      mode: 'compact' as const,
      autoHidePopover: false,
      settingsVisible: false,
      providerId: 'chatgpt' as const,
      providerUrl: 'https://chatgpt.com/'
    }
    expect(shouldHideWindowOnBlur(context)).toBe(true)
    expect(shouldHideWindowOnBlur({ ...context, providerUrl: 'https://chatgpt.com/c/abc123' })).toBe(false)
  })

  it('retains the existing optional Pop Over behavior and does not hide expanded views', () => {
    const context = {
      mode: 'popover' as const,
      autoHidePopover: false,
      settingsVisible: false,
      providerId: 'chatgpt' as const,
      providerUrl: 'https://chatgpt.com/'
    }
    expect(shouldHideWindowOnBlur(context)).toBe(false)
    expect(shouldHideWindowOnBlur({ ...context, autoHidePopover: true })).toBe(true)
    expect(shouldHideWindowOnBlur({ ...context, mode: 'expanded' })).toBe(false)
    expect(shouldHideWindowOnBlur({ ...context, settingsVisible: true })).toBe(false)
  })
})
