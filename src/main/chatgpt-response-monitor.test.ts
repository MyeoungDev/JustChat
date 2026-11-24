import { describe, expect, it } from 'vitest'
import { ChatGPTResponseMonitor, shouldNotifyForChatGPTCompletion } from './chatgpt-response-monitor'

describe('ChatGPTResponseMonitor', () => {
  it('accepts one start and one completion per generation', () => {
    const monitor = new ChatGPTResponseMonitor()
    expect(monitor.consume('started')).toBe('started')
    expect(monitor.consume('started')).toBeUndefined()
    expect(monitor.consume('completed')).toBe('completed')
    expect(monitor.consume('completed')).toBeUndefined()
  })

  it('does not treat a reset or completion without a start as a reply', () => {
    const monitor = new ChatGPTResponseMonitor()
    expect(monitor.consume('completed')).toBeUndefined()
    monitor.consume('started')
    expect(monitor.consume('reset')).toBeUndefined()
    expect(monitor.isGenerating).toBe(false)
    expect(monitor.consume('completed')).toBeUndefined()
  })
})

describe('shouldNotifyForChatGPTCompletion', () => {
  it('requires enabled notifications, a hidden window, and ChatGPT', () => {
    expect(shouldNotifyForChatGPTCompletion({ notificationsEnabled: true, windowVisible: false, providerId: 'chatgpt' })).toBe(true)
    expect(shouldNotifyForChatGPTCompletion({ notificationsEnabled: false, windowVisible: false, providerId: 'chatgpt' })).toBe(false)
    expect(shouldNotifyForChatGPTCompletion({ notificationsEnabled: true, windowVisible: true, providerId: 'chatgpt' })).toBe(false)
    expect(shouldNotifyForChatGPTCompletion({ notificationsEnabled: true, windowVisible: false, providerId: 'claude' })).toBe(false)
  })
})
