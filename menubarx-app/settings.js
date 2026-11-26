const api = window.settingsApp
const form = document.querySelector('#settings-form')
const status = document.querySelector('#status')
const folderLabel = document.querySelector('#download-location')
const customAgentRow = document.querySelector('#custom-ua-row')
const opacityInput = form.elements.opacity
const opacityValue = document.querySelector('#opacity-value')
const mediaVolumeInput = form.elements.mediaVolume
const mediaVolumeValue = document.querySelector('#media-volume-value')
const permissionsList = document.querySelector('#site-permissions')
const shortcutList = document.querySelector('#shortcut-list')
let downloadDirectory = ''
let shortcuts = {}
let recordingButton = null

function formatShortcut(value) {
  if (!value) return 'Not set'
  const mac = api.platform === 'darwin'
  const parts = value.split('+')
  if (mac) {
    const key = parts.pop()
    const order = ['Alt', 'CommandOrControl', 'Command', 'Control', 'Shift', 'Super']
    parts.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    parts.push(key)
  }
  return parts.map((part) => ({
    CommandOrControl: mac ? '⌘' : 'Ctrl', Command: '⌘', Control: 'Ctrl', Alt: mac ? '⌥' : 'Alt',
    Shift: mac ? '⇧' : 'Shift', Super: '⊞', Comma: ',', Period: '.', ',': ',', '.': '.', Plus: '+', Space: 'Space',
    Left: '←', Right: '→', Up: '↑', Down: '↓', PageUp: '⇞', PageDown: '⇟', Enter: '↵'
  })[part] || part).join(mac ? '' : '+')
}

function renderShortcuts(definitions) {
  shortcutList.replaceChildren()
  for (const definition of definitions || []) {
    const row = document.createElement('div')
    row.className = 'shortcut-row'
    const description = document.createElement('span')
    description.className = 'shortcut-description'
    const title = document.createElement('strong')
    title.textContent = definition.label
    const note = document.createElement('small')
    note.textContent = definition.noteOnly ? 'In Notes' : definition.readerOnly ? 'In Book Reader' : definition.mirrorOnly ? 'In Window Mirror' : definition.global ? 'Global · works in other apps' : 'In Floa'
    description.append(title, note)
    const controls = document.createElement('div')
    controls.className = 'shortcut-controls'
    const record = document.createElement('button')
    record.type = 'button'
    record.className = 'secondary shortcut-record'
    record.dataset.shortcut = definition.id
    record.textContent = formatShortcut(shortcuts[definition.id])
    record.setAttribute('aria-label', `Change ${definition.label} shortcut`)
    record.addEventListener('click', () => {
      if (recordingButton) recordingButton.textContent = formatShortcut(shortcuts[recordingButton.dataset.shortcut])
      recordingButton = record
      record.textContent = 'Press keys…'
      record.focus()
    })
    controls.append(record)
    if (!definition.global) {
      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'secondary shortcut-clear'
      clear.textContent = 'Clear'
      clear.setAttribute('aria-label', `Clear ${definition.label} shortcut`)
      clear.addEventListener('click', () => { shortcuts[definition.id] = ''; record.textContent = 'Not set' })
      controls.append(clear)
    }
    row.append(description, controls)
    shortcutList.append(row)
  }
}

function keyCombination(event) {
  const modifiers = []
  if (event.metaKey || event.ctrlKey) modifiers.push('CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  const keys = { ' ': 'Space', ',': 'Comma', '.': 'Period', '+': 'Plus', '-': '-', '/': '/', '?': '/', '[': '[', ']': ']', '`': '`', '=': '=', ';': ';', "'": "'", '\\': '\\', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Enter: 'Enter' }
  let key = keys[event.key] || event.key
  if (/^[a-z]$/.test(key)) key = key.toUpperCase()
  if (!/^[A-Z0-9]$/.test(key) && !/^F([1-9]|1[0-9]|2[0-4])$/.test(key) && !['Comma', 'Period', '/', '-', 'Plus', 'Space', 'Left', 'Right', 'Up', 'Down', 'PageUp', 'PageDown', 'Enter', '[', ']', '`', '=', ';', "'", '\\'].includes(key)) return ''
  if (!modifiers.length) return ''
  if (key === 'Plus') modifiers.push('Shift')
  const canonical = ['CommandOrControl', 'Alt', 'Shift'].filter((item) => modifiers.includes(item))
  return [...canonical, key].join('+')
}

document.addEventListener('keydown', (event) => {
  if (!recordingButton) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.key === 'Escape') {
    recordingButton.textContent = formatShortcut(shortcuts[recordingButton.dataset.shortcut])
    recordingButton = null
    return
  }
  const combo = keyCombination(event)
  if (!combo) { showStatus('Use a letter, number, arrow, or supported key with at least one modifier.', true); return }
  const id = recordingButton.dataset.shortcut
  shortcuts[id] = combo
  recordingButton.textContent = formatShortcut(combo)
  recordingButton = null
  showStatus('Shortcut changed. Save changes to apply it.')
})

function showStatus(message, error = false) {
  status.textContent = message
  status.style.color = error ? '#c43838' : ''
}

function fillSettings(settings) {
  shortcuts = { ...(settings.shortcuts || {}) }
  renderShortcuts(settings.shortcutDefinitions)
  for (const [name, value] of Object.entries(settings)) {
    const control = form.elements.namedItem(name)
    if (!control) continue
    if (control.type === 'checkbox') control.checked = Boolean(value)
    else control.value = String(value ?? '')
  }
  downloadDirectory = settings.downloadDirectory || ''
  folderLabel.textContent = downloadDirectory || 'Downloads'
  customAgentRow.hidden = form.elements.userAgentProfile.value !== 'custom'
  opacityValue.value = `${Math.round(Number(opacityInput.value) * 100)}%`
  mediaVolumeValue.value = `${Math.round(Number(mediaVolumeInput.value) * 100)}%`
  for (const [index, preset] of (settings.windowPresets || []).entries()) {
    const nameInput = form.elements[`presetName${index + 1}`]
    if (nameInput) nameInput.value = preset.name
    const restore = document.querySelector(`.preset-restore[data-preset="${index}"]`)
    if (restore) restore.disabled = !preset.bounds
  }
  renderPermissions(settings.sitePermissions || [])
}

function renderPermissions(permissions) {
  permissionsList.replaceChildren()
  if (!permissions.length) {
    const empty = document.createElement('p')
    empty.className = 'permission-empty'
    empty.textContent = 'No sites have been allowed.'
    permissionsList.append(empty)
    return
  }
  for (const entry of permissions) {
    const row = document.createElement('div')
    row.className = 'permission-entry'
    const label = document.createElement('span')
    label.textContent = `${entry.origin} · ${entry.label}`
    const revoke = document.createElement('button')
    revoke.className = 'secondary'
    revoke.type = 'button'
    revoke.textContent = 'Revoke'
    revoke.addEventListener('click', async () => {
      if (await api.revokePermission(entry.origin, entry.permission)) {
        permissions = permissions.filter((item) => !(item.origin === entry.origin && item.permission === entry.permission))
        renderPermissions(permissions)
        showStatus('Site permission revoked.')
      }
    })
    row.append(label, revoke)
    permissionsList.append(row)
  }
}

function formValues() {
  const values = Object.fromEntries(new FormData(form).entries())
  values.defaultRefreshSeconds = Number(values.defaultRefreshSeconds)
  values.defaultZoomLevel = Number(values.defaultZoomLevel)
  values.maxTabs = Number(values.maxTabs)
  values.discardIdleMinutes = Number(values.discardIdleMinutes)
  values.downloadDirectory = downloadDirectory
  values.shortcuts = { ...shortcuts }
  values.restoreTabs = form.elements.restoreTabs.checked
  values.followSpaces = form.elements.followSpaces.checked
  values.opacity = Number(form.elements.opacity.value)
  values.mediaVolume = Number(form.elements.mediaVolume.value)
  return values
}

form.elements.userAgentProfile.addEventListener('change', () => {
  customAgentRow.hidden = form.elements.userAgentProfile.value !== 'custom'
})
opacityInput.addEventListener('input', () => { opacityValue.value = `${Math.round(Number(opacityInput.value) * 100)}%` })
mediaVolumeInput.addEventListener('input', () => { mediaVolumeValue.value = `${Math.round(Number(mediaVolumeInput.value) * 100)}%` })

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const result = await api.save(formValues())
  if (result?.error) { showStatus(result.error, true); return }
  fillSettings(result.settings)
  showStatus('Settings saved.')
})

document.querySelector('#choose-folder').addEventListener('click', async () => {
  const folder = await api.chooseDownloadFolder()
  if (!folder) return
  downloadDirectory = folder
  folderLabel.textContent = folder
  showStatus('Save changes to apply the new download location.')
})

for (const button of document.querySelectorAll('.preset-save')) {
  button.addEventListener('click', async () => {
    const index = Number(button.dataset.preset)
    const name = form.elements[`presetName${index + 1}`].value
    const result = await api.saveWindowPreset(index, name)
    if (result?.error) { showStatus(result.error, true); return }
    fillSettings(result.settings)
    showStatus(`Window position saved to ${form.elements[`presetName${index + 1}`].value}.`)
  })
}
for (const button of document.querySelectorAll('.preset-restore')) {
  button.addEventListener('click', async () => {
    const restored = await api.restoreWindowPreset(Number(button.dataset.preset))
    if (restored) showStatus('Window position restored.')
  })
}
document.querySelector('#reset-window-layout').addEventListener('click', async () => {
  const result = await api.resetWindowPresets()
  if (result?.settings) fillSettings(result.settings)
  showStatus('Window layout and position presets reset.')
})

document.querySelector('#reset-settings').addEventListener('click', async () => {
  const result = await api.reset()
  if (result?.error) { showStatus(result.error, true); return }
  fillSettings(result.settings)
  showStatus('Default settings restored.')
})

document.querySelector('#close-settings').addEventListener('click', () => api.close())
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === '?' || event.key === '/')) {
    event.preventDefault()
    shortcutList.scrollIntoView({ block: 'start', behavior: 'smooth' })
    shortcutList.querySelector('button')?.focus()
    return
  }
  if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === ',')) {
    event.preventDefault()
    api.close()
  }
})

api.get().then((settings) => { if (settings) fillSettings(settings) })
api.onPermissionsChanged(renderPermissions)
api.onFocusShortcuts(() => {
  shortcutList.scrollIntoView({ block: 'start', behavior: 'smooth' })
  shortcutList.querySelector('button')?.focus()
})
