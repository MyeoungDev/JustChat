import { describe, expect, it } from 'vitest'
import { chatGPTConversationPath, hasChatGPTConversationRoute, isChatGPTSendKey, isCloseWindowShortcut, isSettingsToggleShortcut, shouldCollapseChatGPTSidebar, shouldHideWindowOnBlur } from './window-behavior'

describe('compact chat growth signals', () => {
  it('recognizes an unmodified Enter send key without inspecting page content', () => {
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter' })).toBe(true)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', shift: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', isComposing: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyDown', key: 'Enter', isAutoRepeat: true })).toBe(false)
    expect(isChatGPTSendKey({ type: 'keyUp', key: 'Enter' })).toBe(false)
  })
})

describe('Settings shortcut', () => {
  it('uses Command+, on macOS and only accepts the local unshifted chord', () => {
    expect(isSettingsToggleShortcut({ type: 'keyDown', key: ',', code: 'Comma', meta: true }, 'darwin')).toBe(true)
    expect(isSettingsToggleShortcut({ type: 'keyDown', key: ',', code: 'Comma', meta: true, shift: true }, 'darwin')).toBe(false)
    expect(isSettingsToggleShortcut({ type: 'keyDown', key: ',', code: 'Comma', control: true }, 'darwin')).toBe(false)
    expect(isSettingsToggleShortcut({ type: 'keyUp', key: ',', code: 'Comma', meta: true }, 'darwin')).toBe(false)
  })

  it('uses Control+, on non-macOS platforms', () => {
    expect(isSettingsToggleShortcut({ type: 'keyDown', key: ',', code: 'Comma', control: true }, 'win32')).toBe(true)
    expect(isSettingsToggleShortcut({ type: 'keyDown', key: ',', code: 'Comma', meta: true }, 'win32')).toBe(false)
  })
})

describe('macOS window close shortcut', () => {
  it('recognizes Command+W only on macOS', () => {
    expect(isCloseWindowShortcut({ type: 'keyDown', key: 'w', code: 'KeyW', meta: true }, 'darwin')).toBe(true)
    expect(isCloseWindowShortcut({ type: 'keyDown', key: 'w', code: 'KeyW', meta: true, shift: true }, 'darwin')).toBe(false)
    expect(isCloseWindowShortcut({ type: 'keyDown', key: 'w', code: 'KeyW', control: true }, 'darwin')).toBe(false)
    expect(isCloseWindowShortcut({ type: 'keyDown', key: 'w', code: 'KeyW', control: true }, 'win32')).toBe(false)
  })
})

describe('window blur behavior', () => {
  it('recognizes regular ChatGPT conversation routes without inspecting page content', () => {
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/c/abc123')).toBe(true)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/g/gpt-name/c/abc123')).toBe(true)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/')).toBe(false)
    expect(hasChatGPTConversationRoute('chatgpt', 'https://chatgpt.com/?temporary-chat=true')).toBe(false)
    expect(hasChatGPTConversationRoute('claude', 'https://chatgpt.com/c/abc123')).toBe(false)
    expect(chatGPTConversationPath('chatgpt', 'https://chatgpt.com/g/gpt-name/c/abc123?model=x')).toBe('/g/gpt-name/c/abc123')
    expect(chatGPTConversationPath('chatgpt', 'https://example.com/c/abc123')).toBeUndefined()
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

describe('compact sidebar initialization', () => {
  it('collapses only for a compact ChatGPT home, not on later conversation or expanded syncs', () => {
    expect(shouldCollapseChatGPTSidebar({ mode: 'compact', providerId: 'chatgpt', providerUrl: 'https://chatgpt.com/' })).toBe(true)
    expect(shouldCollapseChatGPTSidebar({ mode: 'compact', providerId: 'chatgpt', providerUrl: 'https://chatgpt.com/c/abc123' })).toBe(false)
    expect(shouldCollapseChatGPTSidebar({ mode: 'expanded', providerId: 'chatgpt', providerUrl: 'https://chatgpt.com/' })).toBe(false)
    expect(shouldCollapseChatGPTSidebar({ mode: 'compact', providerId: 'claude', providerUrl: 'https://chatgpt.com/' })).toBe(false)
  })
})
