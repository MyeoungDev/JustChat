import type { ProviderId } from './providers'
import type { WindowMode } from './window-layout'

export interface WindowBlurContext {
  mode: WindowMode
  autoHidePopover: boolean
  settingsVisible: boolean
  providerId: ProviderId
  providerUrl: string
}

export function hasChatGPTConversationRoute(providerId: ProviderId, rawUrl: string): boolean {
  if (providerId !== 'chatgpt') return false
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || !['chatgpt.com', 'www.chatgpt.com'].includes(url.hostname)) return false
    return /(?:^|\/)c\/[^/]+(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
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
