import type { ProviderId } from './providers'
import type { WindowMode } from './window-layout'

export interface WindowBlurContext {
  mode: WindowMode
  autoHidePopover: boolean
  settingsVisible: boolean
  providerId: ProviderId
  providerUrl: string
}

export function isSettingsToggleShortcut(input: {
  type: string
  key: string
  code: string
  alt?: boolean
  control?: boolean
  meta?: boolean
  shift?: boolean
}, platform: NodeJS.Platform): boolean {
  if (input.type !== 'keyDown' || input.alt || input.shift) return false
  const modifierPressed = platform === 'darwin' ? input.meta && !input.control : input.control && !input.meta
  return Boolean(modifierPressed && (input.key === ',' || input.code.toLowerCase() === 'comma'))
}

export function isCloseWindowShortcut(input: {
  type: string
  key: string
  code: string
  alt?: boolean
  control?: boolean
  meta?: boolean
  shift?: boolean
}, platform: NodeJS.Platform): boolean {
  if (platform !== 'darwin' || input.type !== 'keyDown' || input.alt || input.control || input.shift || !input.meta) return false
  return input.key.toLowerCase() === 'w' || input.code.toLowerCase() === 'keyw'
}

export function hasChatGPTConversationRoute(providerId: ProviderId, rawUrl: string): boolean {
  return chatGPTConversationPath(providerId, rawUrl) !== undefined
}

export function chatGPTConversationPath(providerId: ProviderId, rawUrl: string): string | undefined {
  if (providerId !== 'chatgpt') return undefined
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || !['chatgpt.com', 'www.chatgpt.com'].includes(url.hostname)) return undefined
    return /(?:^|\/)c\/[^/]+(?:\/|$)/i.test(url.pathname) ? url.pathname : undefined
  } catch {
    return undefined
  }
}

export function isChatGPTSendKey(input: {
  type: string
  key: string
  isAutoRepeat?: boolean
  isComposing?: boolean
  shift?: boolean
  control?: boolean
  alt?: boolean
  meta?: boolean
}): boolean {
  return input.type === 'keyDown'
    && (input.key === 'Enter' || input.key === 'Return')
    && !input.isAutoRepeat
    && !input.isComposing
    && !input.shift
    && !input.control
    && !input.alt
    && !input.meta
}

export function shouldHideWindowOnBlur(context: WindowBlurContext): boolean {
  if (context.settingsVisible) return false
  if (context.mode === 'popover') return context.autoHidePopover
  if (context.mode !== 'compact') return false
  return !hasChatGPTConversationRoute(context.providerId, context.providerUrl)
}
