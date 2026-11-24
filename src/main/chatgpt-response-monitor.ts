export type ChatGPTResponseSignal = 'started' | 'completed' | 'reset'

/** Tracks one generation cycle and rejects duplicate or out-of-order DOM signals. */
export class ChatGPTResponseMonitor {
  private generating = false

  consume(signal: ChatGPTResponseSignal): 'started' | 'completed' | undefined {
    if (signal === 'reset') {
      this.generating = false
      return undefined
    }
    if (signal === 'started') {
      if (this.generating) return undefined
      this.generating = true
      return 'started'
    }
    if (!this.generating) return undefined
    this.generating = false
    return 'completed'
  }

  get isGenerating() {
    return this.generating
  }
}

export function shouldNotifyForChatGPTCompletion(input: {
  notificationsEnabled: boolean
  windowVisible: boolean
  providerId: string
}): boolean {
  return input.notificationsEnabled && !input.windowVisible && input.providerId === 'chatgpt'
}
