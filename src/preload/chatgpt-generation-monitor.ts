import { ipcRenderer } from 'electron'

type Signal = 'started' | 'completed' | 'reset'

const stopSelector = [
  'button[data-testid="stop-button"]',
  'button[aria-label*="stop generating" i]',
  'button[aria-label*="stop response" i]'
].join(',')
const completionActionSelector = [
  'button[data-testid="copy-turn-action-button"]',
  'button[data-testid="good-response-turn-action-button"]',
  'button[aria-label*="copy" i]'
].join(',')

let generationWasRunning = false
let stopWasRequested = false
let settleTimer: number | undefined
let settleChecks = 0
let observer: MutationObserver | undefined

function visible(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.getClientRects().length > 0
}

function lastAssistantTurn() {
  const turns = document.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]')
  return turns.item(turns.length - 1) ?? null
}

function hasStopControl() {
  return Array.from(document.querySelectorAll(stopSelector)).some(visible)
}

function hasCompletedTurnActions() {
  const turn = lastAssistantTurn()
  if (!turn) return false
  const text = `${turn.innerText ?? ''} ${turn.getAttribute('data-state') ?? ''}`.toLowerCase()
  if (/continue generating|retry|something went wrong|error generating/.test(text)) return false
  return Array.from(turn.querySelectorAll(completionActionSelector)).some(visible)
}

function send(signal: Signal) {
  ipcRenderer.send('chatgpt:generation-state', signal)
}

function clearSettleTimer() {
  if (settleTimer !== undefined) window.clearTimeout(settleTimer)
  settleTimer = undefined
  settleChecks = 0
}

function settleGeneration() {
  settleTimer = undefined
  if (!generationWasRunning || hasStopControl()) return

  settleChecks += 1
  if (stopWasRequested) {
    generationWasRunning = false
    stopWasRequested = false
    send('reset')
    settleChecks = 0
    return
  }
  if (hasCompletedTurnActions()) {
    generationWasRunning = false
    stopWasRequested = false
    send('completed')
    settleChecks = 0
    return
  }

  if (settleChecks >= 10) {
    generationWasRunning = false
    stopWasRequested = false
    send('reset')
    settleChecks = 0
    return
  }
  settleTimer = window.setTimeout(settleGeneration, 500)
}

function inspectGenerationState() {
  if (hasStopControl()) {
    clearSettleTimer()
    if (!generationWasRunning) {
      generationWasRunning = true
      stopWasRequested = false
      send('started')
    }
    return
  }
  if (generationWasRunning && settleTimer === undefined) {
    settleTimer = window.setTimeout(settleGeneration, 500)
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !generationWasRunning) return
  const target = event.target.closest(stopSelector)
  if (target && visible(target)) stopWasRequested = true
}, true)

function installObserver() {
  if (!document.body || observer) return
  observer = new MutationObserver(inspectGenerationState)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-testid', 'disabled'] })
  inspectGenerationState()
}

document.addEventListener('DOMContentLoaded', installObserver, { once: true })
if (document.readyState !== 'loading') installObserver()
window.addEventListener('pagehide', () => {
  observer?.disconnect()
  observer = undefined
  clearSettleTimer()
  if (generationWasRunning) send('reset')
  generationWasRunning = false
  stopWasRequested = false
})
