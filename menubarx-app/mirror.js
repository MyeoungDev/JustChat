const $ = (id) => document.getElementById(id)
const picker = $('picker')
const preview = $('preview')
const permission = $('permission')
const sourcesNode = $('sources')
const video = $('video')
const mirrorTabs = new Map()
let activeSourceId = ''
let loadingSources = false
let lastPointerMoveAt = 0
let lastPointerPosition = null

function notice(message) { $('notice').textContent = message || '' }

function setToolbarState({ picking = false } = {}) {
  const hasMirrors = mirrorTabs.size > 0
  $('refresh').hidden = !picking || !permission.hidden
  $('choose-again').hidden = !hasMirrors || !permission.hidden
  $('choose-again').textContent = picking ? 'Back to preview' : 'Add window'
  $('stop').hidden = !hasMirrors || !permission.hidden
  $('stop').textContent = 'Stop all'
}

function updatePreviewControls() {
  const item = mirrorTabs.get(activeSourceId)
  $('open-original').hidden = window.mirrorApp.platform !== 'darwin' || !item
  $('interact').hidden = window.mirrorApp.platform !== 'darwin' || !item
  $('interact').setAttribute('aria-pressed', String(Boolean(item?.interactive)))
  $('interact').textContent = item?.interactive ? 'Stop Interacting' : 'Interact'
  $('preview').classList.toggle('interactive', Boolean(item?.interactive))
  video.tabIndex = item?.interactive ? 0 : -1
  $('preview-caption').textContent = item?.interactive
    ? 'Interact is on · pointer and keyboard input go to this selected window'
    : 'Preview only · turn on Interact to send input to this selected window'
}

function renderTabs() {
  const nav = $('mirror-tabs')
  nav.replaceChildren()
  nav.hidden = mirrorTabs.size === 0
  if (mirrorTabs.size) {
    const live = document.createElement('span'); live.className = 'mirror-tabs-live'; live.textContent = '● LIVE'; live.setAttribute('aria-label', 'Window capture is active')
    nav.append(live)
  }
  for (const [id, item] of mirrorTabs) {
    const tab = document.createElement('div'); tab.className = 'mirror-tab'; tab.setAttribute('role', 'presentation'); tab.setAttribute('aria-selected', String(id === activeSourceId))
    const select = document.createElement('button'); select.type = 'button'; select.className = 'mirror-tab-select'; select.setAttribute('role', 'tab'); select.setAttribute('aria-selected', String(id === activeSourceId)); select.title = item.name; select.textContent = item.name
    select.addEventListener('click', () => { void showPreview(id) })
    const close = document.createElement('button'); close.type = 'button'; close.className = 'mirror-tab-close'; close.setAttribute('aria-label', `Stop mirroring ${item.name}`); close.title = `Stop ${item.name}`; close.textContent = '×'
    close.addEventListener('click', () => stopMirrorTab(id))
    tab.append(select, close); nav.append(tab)
  }
  setToolbarState({ picking: !picker.hidden })
}

function showPermission() {
  picker.hidden = true
  preview.hidden = true
  permission.hidden = false
  $('subtitle').textContent = 'Screen Recording permission required'
  setToolbarState()
}

async function loadSources() {
  if (loadingSources) return
  loadingSources = true
  notice('Loading open windows…')
  sourcesNode.replaceChildren()
  picker.hidden = false
  preview.hidden = true
  permission.hidden = true
  setToolbarState({ picking: true })
  try {
    const sources = await window.mirrorApp.sources()
    if (sources?.error === 'screen-permission') { showPermission(); return }
    if (sources?.error) throw new Error(sources.error)
    if (!Array.isArray(sources) || !sources.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No app windows are available. Open a window and refresh the list.'
      sourcesNode.append(empty)
    } else for (const source of sources) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'source-card'; card.setAttribute('aria-label', `Preview ${source.name}`)
      const thumbnail = document.createElement('img'); thumbnail.alt = ''; thumbnail.src = source.thumbnail
      const meta = document.createElement('span'); meta.className = 'source-meta'
      if (source.icon) { const icon = document.createElement('img'); icon.alt = ''; icon.src = source.icon; meta.append(icon) }
      const name = document.createElement('strong'); name.textContent = source.name; meta.append(name)
      card.append(thumbnail, meta)
      card.addEventListener('click', () => { void startPreview(source) })
      sourcesNode.append(card)
    }
    $('subtitle').textContent = mirrorTabs.size ? 'Add another window or return to a live preview' : `${sources.length} open window${sources.length === 1 ? '' : 's'} · select one to preview`
    notice('')
  } catch (error) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = error.message || 'Could not list open windows.'
    sourcesNode.append(empty); notice('Window previews need Screen Recording permission on macOS.')
  } finally { loadingSources = false; $('refresh').disabled = false }
}

async function startPreview(source) {
  if (mirrorTabs.has(source.id)) { await showPreview(source.id); return }
  notice('Requesting access to the selected window…')
  try {
    const allowed = await window.mirrorApp.authorizeSource(source.id)
    if (!allowed) throw new Error('This window is no longer available. Refresh the list and try again.')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 24 } }
    })
    const item = { id: source.id, name: source.name, stream, interactive: false }
    mirrorTabs.set(source.id, item)
    const track = stream.getVideoTracks()[0]
    track?.addEventListener('ended', () => {
      if (mirrorTabs.get(source.id) !== item) return
      stopMirrorTab(source.id)
      notice(`${source.name} is no longer being captured.`)
    }, { once: true })
    await showPreview(source.id)
    notice('')
  } catch (error) {
    void window.mirrorApp.revokeSource(source.id)
    const permissionStatus = await window.mirrorApp.sources()
    if (permissionStatus?.error === 'screen-permission') { showPermission(); return }
    picker.hidden = false
    preview.hidden = true
    setToolbarState({ picking: true })
    notice(error?.name === 'NotAllowedError' ? 'Screen Recording was not allowed. Check macOS Privacy Settings and try again.' : (error?.message || 'Could not start the window preview.'))
  }
}

async function showPreview(sourceId) {
  const item = mirrorTabs.get(sourceId)
  if (!item) return
  const selection = await window.mirrorApp.selectSource(sourceId)
  if (!selection?.ok) { notice(selection?.error || 'Could not select this mirror source.'); return }
  const previous = mirrorTabs.get(selection.previousSourceId)
  if (previous && selection.previousSourceId !== sourceId) previous.interactive = false
  activeSourceId = sourceId
  video.pause()
  video.srcObject = item.stream
  picker.hidden = true
  permission.hidden = true
  preview.hidden = false
  $('subtitle').textContent = `Live preview · ${item.name}`
  renderTabs()
  updatePreviewControls()
  try { await video.play() } catch (error) { notice(error.message || 'Could not show this window preview.') }
}

async function setInteraction(enabled) {
  const item = mirrorTabs.get(activeSourceId)
  if (!item) return
  const result = await window.mirrorApp.setInteraction(item.id, enabled)
  if (!result?.ok) {
    if (result?.needsAccessibility) $('open-accessibility-settings').hidden = false
    notice(result?.error || 'Could not change interaction mode.')
    return
  }
  $('open-accessibility-settings').hidden = true
  item.interactive = Boolean(result.enabled)
  updatePreviewControls()
  if (item.interactive) { video.focus(); notice('Interact is on for this window only.') }
  else { notice('Interact is off. The preview is read-only.') }
}

async function openOriginal() {
  if (!activeSourceId) return
  const result = await window.mirrorApp.raiseOriginal(activeSourceId)
  if (result?.needsAccessibility) $('open-accessibility-settings').hidden = false
  notice(result?.ok ? 'Opened the selected original window.' : (result?.error || 'Could not open the original window.'))
}

function pointOnVideo(event) {
  if (!video.videoWidth || !video.videoHeight) return null
  const rect = video.getBoundingClientRect()
  const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight)
  const drawnWidth = video.videoWidth * scale; const drawnHeight = video.videoHeight * scale
  const x = event.clientX - rect.left - (rect.width - drawnWidth) / 2
  const y = event.clientY - rect.top - (rect.height - drawnHeight) / 2
  if (x < 0 || y < 0 || x > drawnWidth || y > drawnHeight) return null
  return { x: x / drawnWidth, y: y / drawnHeight }
}

function sendPointer(event, action) {
  const point = pointOnVideo(event) || (action === 'up' || action === 'rightUp' ? lastPointerPosition : null)
  if (!point || !activeSourceId) return
  const sourceId = activeSourceId
  lastPointerPosition = point
  void window.mirrorApp.sendInput(sourceId, { action, ...point }).then((result) => {
    if (!result?.ok) {
      const item = mirrorTabs.get(sourceId)
      if (item?.interactive && activeSourceId === sourceId) void setInteraction(false)
      notice(result?.error || 'Input could not be sent to the selected window.')
    }
  })
}

const macKeyCodes = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyH: 4, KeyG: 5, KeyZ: 6, KeyX: 7, KeyC: 8, KeyV: 9, KeyB: 11,
  KeyQ: 12, KeyW: 13, KeyE: 14, KeyR: 15, KeyY: 16, KeyT: 17, Digit1: 18, Digit2: 19, Digit3: 20,
  Digit4: 21, Digit6: 22, Digit5: 23, Equal: 24, Digit9: 25, Digit7: 26, Minus: 27, Digit8: 28, Digit0: 29,
  BracketRight: 30, KeyO: 31, KeyU: 32, BracketLeft: 33, KeyI: 34, KeyP: 35, Enter: 36, KeyL: 37, KeyJ: 38,
  Quote: 39, KeyK: 40, Semicolon: 41, Backslash: 42, Comma: 43, Slash: 44, KeyN: 45, KeyM: 46, Period: 47,
  Tab: 48, Space: 49, Backquote: 50, Backspace: 51, Escape: 53, ArrowLeft: 123, ArrowRight: 124, ArrowDown: 125, ArrowUp: 126
}

function sendKey(event, action) {
  const keyCode = macKeyCodes[event.code]
  if (!Number.isInteger(keyCode) || !activeSourceId) return
  const sourceId = activeSourceId
  event.preventDefault(); event.stopPropagation()
  let flags = 0
  if (event.shiftKey) flags |= 0x00020000
  if (event.ctrlKey) flags |= 0x00040000
  if (event.altKey) flags |= 0x00080000
  if (event.metaKey) flags |= 0x00100000
  void window.mirrorApp.sendInput(sourceId, { action, keyCode, flags }).then((result) => {
    if (!result?.ok) {
      const item = mirrorTabs.get(sourceId)
      if (item?.interactive && activeSourceId === sourceId) void setInteraction(false)
      notice(result?.error || 'Key input could not be sent to the selected window.')
    }
  })
}

function stopMirrorTab(sourceId) {
  const item = mirrorTabs.get(sourceId)
  if (!item) return
  mirrorTabs.delete(sourceId)
  void window.mirrorApp.revokeSource(sourceId)
  item.stream.getTracks().forEach((track) => track.stop())
  if (activeSourceId === sourceId) {
    activeSourceId = ''
    const next = mirrorTabs.keys().next().value
    if (next) { void showPreview(next); return }
    video.pause(); video.srcObject = null
    void loadSources()
  }
  renderTabs()
}

function stopAll(returnToPicker = true) {
  const ids = [...mirrorTabs.keys()]
  activeSourceId = ''
  video.pause(); video.srcObject = null
  for (const id of ids) {
    const item = mirrorTabs.get(id)
    mirrorTabs.delete(id)
    void window.mirrorApp.revokeSource(id)
    item?.stream.getTracks().forEach((track) => track.stop())
  }
  renderTabs()
  if (returnToPicker) void loadSources()
}

function cycleMirrorTab(direction) {
  const ids = [...mirrorTabs.keys()]
  if (!ids.length) return
  const current = Math.max(0, ids.indexOf(activeSourceId))
  const next = (current + direction + ids.length) % ids.length
  void showPreview(ids[next])
}

$('refresh').addEventListener('click', () => { void loadSources() })
$('choose-again').addEventListener('click', () => {
  if (!picker.hidden && mirrorTabs.size) { void showPreview(activeSourceId || mirrorTabs.keys().next().value); return }
  void loadSources()
})
$('stop').addEventListener('click', stopAll)
$('close').addEventListener('click', () => { stopAll(false); void window.mirrorApp.close() })
$('open-settings').addEventListener('click', () => { void window.mirrorApp.openScreenSettings() })
$('interact').addEventListener('click', () => { void setInteraction(!mirrorTabs.get(activeSourceId)?.interactive) })
$('open-original').addEventListener('click', () => { void openOriginal() })
$('open-accessibility-settings').addEventListener('click', () => { void window.mirrorApp.openAccessibilitySettings() })
video.addEventListener('pointerdown', (event) => {
  if (!mirrorTabs.get(activeSourceId)?.interactive || (event.button !== 0 && event.button !== 2)) return
  event.preventDefault(); video.focus()
  try { video.setPointerCapture(event.pointerId) } catch {}
  sendPointer(event, event.button === 2 ? 'rightDown' : 'down')
})
video.addEventListener('pointerup', (event) => {
  if (!mirrorTabs.get(activeSourceId)?.interactive || (event.button !== 0 && event.button !== 2)) return
  event.preventDefault(); sendPointer(event, event.button === 2 ? 'rightUp' : 'up')
  try { video.releasePointerCapture(event.pointerId) } catch {}
})
video.addEventListener('pointermove', (event) => {
  if (!mirrorTabs.get(activeSourceId)?.interactive) return
  const now = performance.now()
  if (now - lastPointerMoveAt < (event.buttons ? 25 : 75)) return
  lastPointerMoveAt = now
  sendPointer(event, event.buttons & 2 ? 'rightDrag' : event.buttons & 1 ? 'drag' : 'move')
})
video.addEventListener('wheel', (event) => {
  if (!mirrorTabs.get(activeSourceId)?.interactive) return
  const point = pointOnVideo(event)
  if (!point) return
  event.preventDefault()
  void window.mirrorApp.sendInput(activeSourceId, { action: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY })
}, { passive: false })
video.addEventListener('keydown', (event) => { if (mirrorTabs.get(activeSourceId)?.interactive) sendKey(event, 'keyDown') })
video.addEventListener('keyup', (event) => { if (mirrorTabs.get(activeSourceId)?.interactive) sendKey(event, 'keyUp') })
video.addEventListener('contextmenu', (event) => { if (mirrorTabs.get(activeSourceId)?.interactive) event.preventDefault() })
window.addEventListener('beforeunload', () => stopAll(false))
window.mirrorApp.onCommand((command) => {
  if (command === 'new') void loadSources()
  else if (command === 'close') { if (activeSourceId) stopMirrorTab(activeSourceId) }
  else if (command === 'next') cycleMirrorTab(1)
  else if (command === 'previous') cycleMirrorTab(-1)
})
void loadSources()
