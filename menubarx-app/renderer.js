const api = window.browserApp
const tabsNode = document.querySelector('#tabs')
const newTabButton = document.querySelector('#new-tab')
const address = document.querySelector('#address')
const homeAddress = document.querySelector('#home-address')
const home = document.querySelector('#home')
let state = { tabs: [], bookmarks: [], activeTabId: null, workspace: 'browser', pinned: false, expanded: false, screenFilled: false, muted: false, canGoBack: false, canGoForward: false }
let noticeTimer
let editingBookmarkUrl = ''
let findRequestId = 0
let findQuery = ''
let lastStateRevision = -1

function receiveState(next) {
  if (!next) return
  const revision = Number.isFinite(next.revision) ? next.revision : 0
  if (revision < lastStateRevision) return
  lastStateRevision = revision
  state = next
  render()
}

function formatShortcut(value) {
  if (!value) return ''
  const mac = api.platform === 'darwin'
  const parts = value.split('+')
  if (mac) {
    const key = parts.pop()
    const order = ['Alt', 'CommandOrControl', 'Command', 'Control', 'Shift', 'Super']
    parts.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    parts.push(key)
  }
  const names = {
    CommandOrControl: mac ? '⌘' : 'Ctrl', Command: '⌘', Control: mac ? '⌃' : 'Ctrl',
    Alt: mac ? '⌥' : 'Alt', Shift: mac ? '⇧' : 'Shift', Super: mac ? '⌘' : 'Win',
    Comma: ',', Period: '.', ',': ',', '.': '.', Plus: '+', Space: 'Space', Left: '←', Right: '→', Up: '↑', Down: '↓'
  }
  return parts.map((part) => names[part] || part).join(mac ? '' : '+')
}

function setToolbarHelp(id, label, shortcutId) {
  const button = document.querySelector(`#${id}`)
  const shortcut = formatShortcut(state.settings?.shortcuts?.[shortcutId])
  const tooltip = shortcut ? `${label} · ${shortcut}` : label
  button.dataset.tooltip = tooltip
  button.title = tooltip
  button.setAttribute('aria-label', tooltip)
}

async function newTab() {
  const result = await api.newTab()
  if (result?.error) showNotice(result.error)
}

function render() {
  document.body.classList.toggle('clean-mode', Boolean(state.cleanMode))
  tabsNode.replaceChildren()
  for (const tab of state.tabs) {
    const button = document.createElement('div')
    const active = state.workspace === 'browser' && tab.id === state.activeTabId
    button.className = `tab${active ? ' active' : ''}`
    button.setAttribute('role', 'group')
    button.setAttribute('aria-current', active ? 'page' : 'false')
    button.setAttribute('aria-label', `Tab ${state.tabs.indexOf(tab) + 1}: ${tab.title || 'New tab'}`)
    button.title = tab.url || 'New tab'
    const select = document.createElement('button')
    select.className = 'tab-select'
    select.type = 'button'
    select.setAttribute('aria-label', `Switch to ${tab.title || 'new tab'}`)
    if (active) select.setAttribute('aria-current', 'page')
    select.tabIndex = active ? 0 : -1
    const title = document.createElement('span')
    title.className = 'tab-title'
    title.textContent = tab.title || (tab.url ? new URL(tab.url).hostname : 'New Tab')
    select.append(title)
    select.addEventListener('click', () => api.activateTab(tab.id))
    button.append(select)
    if (tab.discarded) button.classList.add('discarded')
    if (state.tabs.length > 1) {
      const close = document.createElement('button')
      close.className = 'tab-close'
      close.type = 'button'
      close.textContent = '×'
      close.title = 'Close tab'
      close.setAttribute('aria-label', `Close ${tab.title || 'tab'}`)
      close.addEventListener('click', (event) => { event.stopPropagation(); api.closeTab(tab.id) })
      button.append(close)
    }
    tabsNode.append(button)
    button.addEventListener('keydown', (event) => {
      const index = state.tabs.findIndex((item) => item.id === tab.id)
      const nextIndex = event.key === 'ArrowRight' ? (index + 1) % state.tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + state.tabs.length) % state.tabs.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? state.tabs.length - 1 : -1
      if (nextIndex < 0 || !state.tabs[nextIndex]) return
      event.preventDefault()
      api.activateTab(state.tabs[nextIndex].id)
      tabsNode.querySelectorAll('.tab-select')[nextIndex]?.focus()
    })
  }
  const active = state.workspace === 'browser' ? state.tabs.find((tab) => tab.id === state.activeTabId) : null
  address.value = active?.url || ''
  const browserTabActive = state.workspace === 'browser'
  for (const id of ['back', 'forward', 'home-button', 'reload', 'bookmark']) {
    document.querySelector(`#${id}`).disabled = !browserTabActive
  }
  address.disabled = !browserTabActive
  document.querySelector('#back').disabled = !state.canGoBack
  document.querySelector('#forward').disabled = !state.canGoForward
  const favorite = Boolean(active?.url && state.bookmarks.some((item) => item.url === active.url))
  const bookmarkButton = document.querySelector('#bookmark')
  bookmarkButton.classList.toggle('active', favorite)
  bookmarkButton.setAttribute('aria-pressed', String(favorite))
  bookmarkButton.querySelector('.action-label').textContent = favorite ? 'Saved' : 'Favorite'
  const help = [
    ['back', 'Go back', 'back'],
    ['forward', 'Go forward', 'forward'],
    ['home-button', 'Open start page', 'startPage'],
    ['reload', 'Reload page', 'reload'],
    ['bookmark', favorite ? 'Remove from Favorites' : 'Add to Favorites', null],
    ['menu-button', 'Open browser menu', null]
  ]
  for (const [id, label, shortcut] of help) setToolbarHelp(id, label, shortcut)
  const newTabHint = formatShortcut(state.settings?.shortcuts?.newTab)
  newTabButton.dataset.tooltip = newTabHint ? `New tab · ${newTabHint}` : 'New tab'
  newTabButton.title = newTabButton.dataset.tooltip
  home.hidden = Boolean(active?.url)
  renderBookmarks()
}

newTabButton.addEventListener('click', () => newTab())

function renderBookmarks() {
  const container = document.querySelector('#bookmarks')
  const folderFilter = document.querySelector('#favorite-folder-filter')
  const folders = [...new Set(state.bookmarks.map((item) => String(item.folder || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const selectedFolder = folders.includes(folderFilter.value) ? folderFilter.value : ''
  folderFilter.replaceChildren(new Option('All folders', ''), ...folders.map((folder) => new Option(folder, folder)))
  folderFilter.value = selectedFolder
  const folderOptions = document.querySelector('#favorite-folder-options')
  folderOptions.replaceChildren(...folders.map((folder) => new Option('', folder)))
  container.replaceChildren()
  if (!state.bookmarks.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-bookmarks'
    empty.textContent = 'Your favorite sites will appear here. Open a site and select ☆ to save it.'
    container.append(empty)
    return
  }
  const visible = selectedFolder === '' ? state.bookmarks : state.bookmarks.filter((item) => (item.folder || '') === selectedFolder)
  const grouped = new Map()
  for (const item of visible) {
    const folder = String(item.folder || '').trim() || 'Unfiled'
    if (!grouped.has(folder)) grouped.set(folder, [])
    grouped.get(folder).push(item)
  }
  for (const [folder, items] of grouped) {
    const group = document.createElement('section'); group.className = 'bookmark-folder'
    const heading = document.createElement('h3'); heading.className = 'bookmark-folder-title'; heading.textContent = folder
    const grid = document.createElement('div'); grid.className = 'bookmark-folder-grid'
    group.append(heading, grid); container.append(group)
    for (const item of items) {
    const tile = document.createElement('article')
    tile.className = 'bookmark-tile'
    tile.title = item.url
    const button = document.createElement('button')
    button.className = 'bookmark-open'
    button.type = 'button'
    const icon = document.createElement('span')
    icon.className = 'bookmark-icon'
    icon.textContent = item.icon || item.title.trim().slice(0, 1).toUpperCase() || 'W'
    const title = document.createElement('span')
    title.className = 'bookmark-title'
    title.textContent = item.title
    button.append(icon, title)
    button.addEventListener('click', () => api.openBookmark(item.url))
    const actions = document.createElement('div')
    actions.className = 'bookmark-actions'
    for (const [label, glyph, action] of [
      ['Edit favorite', '✎', () => editFavorite(item)],
      ['Move up', '↑', () => api.moveBookmark(item.url, -1)],
      ['Move down', '↓', () => api.moveBookmark(item.url, 1)],
      ['Remove favorite', '×', () => api.removeBookmark(item.url)]
    ]) {
      const control = document.createElement('button')
      control.className = 'bookmark-action'
      control.type = 'button'
      control.title = label
      control.dataset.tooltip = label
      control.setAttribute('aria-label', label)
      control.textContent = glyph
      control.addEventListener('click', (event) => { event.stopPropagation(); action() })
      actions.append(control)
    }
    tile.append(button, actions)
    grid.append(tile)
    }
  }
}

function editFavorite(item = null) {
  editingBookmarkUrl = item?.url || ''
  document.querySelector('#bookmark-dialog-title').textContent = item ? 'Edit favorite' : 'Add favorite'
  document.querySelector('#favorite-title').value = item?.title || ''
  document.querySelector('#favorite-url').value = item?.url || ''
  document.querySelector('#favorite-icon').value = item?.icon || ''
  document.querySelector('#favorite-folder').value = item?.folder || ''
  document.querySelector('#bookmark-editor').showModal()
}

function showNotice(message) {
  const node = document.querySelector('#notice')
  node.textContent = message
  node.hidden = !message
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => { node.hidden = true }, 4500)
}

async function submitAddress(input) {
  const value = input.trim()
  if (!value) return
  const result = await api.navigate(value)
  if (result?.error) showNotice(result.error)
  else showNotice('')
}

document.querySelector('#address-form').addEventListener('submit', (event) => { event.preventDefault(); submitAddress(address.value) })
document.querySelector('#home-form').addEventListener('submit', (event) => { event.preventDefault(); submitAddress(homeAddress.value) })
document.querySelector('#back').addEventListener('click', () => api.back())
document.querySelector('#forward').addEventListener('click', () => api.forward())
document.querySelector('#home-button').addEventListener('click', () => api.home())
document.querySelector('#reload').addEventListener('click', () => api.reload())
document.querySelector('#bookmark').addEventListener('click', () => {
  const active = state.tabs.find((tab) => tab.id === state.activeTabId)
  if (!active?.url) return
  if (state.bookmarks.some((item) => item.url === active.url)) api.removeBookmark(active.url)
  else api.addBookmark()
})
const findBar = document.querySelector('#find-bar')
const findInput = document.querySelector('#find-query')
const findCount = document.querySelector('#find-count')
async function searchPage(direction = 'forward') {
  const query = findInput.value
  if (!query) { findCount.textContent = ''; await api.findInPage('', direction); findQuery = ''; return }
  const mode = query === findQuery ? direction : 'new'
  findQuery = query
  const result = await api.findInPage(query, mode)
  findRequestId = result?.requestId || 0
}
function closeFind() {
  findBar.hidden = true
  findCount.textContent = ''
  findQuery = ''
  void api.closeFind()
}
api.onFindClose(closeFind)
findInput.addEventListener('input', () => { findCount.textContent = '…'; void searchPage() })
findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); void searchPage(event.shiftKey ? 'backward' : 'next') }
  if (event.key === 'Escape') { event.preventDefault(); closeFind() }
})
document.querySelector('#find-previous').addEventListener('click', () => { void searchPage('backward') })
document.querySelector('#find-next').addEventListener('click', () => { void searchPage('next') })
document.querySelector('#find-close').addEventListener('click', closeFind)
api.onFindResult((result) => {
  if (result.requestId !== findRequestId || !result.finalUpdate) return
  findCount.textContent = result.matches ? `${result.activeMatchOrdinal} / ${result.matches}` : 'No matches'
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !findBar.hidden) { event.preventDefault(); closeFind() }
})
document.querySelector('#menu-button').addEventListener('click', () => api.showMenu())
document.querySelector('#open-history').addEventListener('click', () => api.openHistory())
document.querySelector('#add-favorite').addEventListener('click', () => editFavorite())
document.querySelector('#favorite-folder-filter').addEventListener('change', renderBookmarks)
document.querySelector('#cancel-favorite').addEventListener('click', () => document.querySelector('#bookmark-editor').close())
document.querySelector('#bookmark-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const result = await api.saveBookmark({ originalUrl: editingBookmarkUrl, title: document.querySelector('#favorite-title').value, url: document.querySelector('#favorite-url').value, icon: document.querySelector('#favorite-icon').value, folder: document.querySelector('#favorite-folder').value })
  if (result?.error) { showNotice(result.error); return }
  document.querySelector('#bookmark-editor').close()
})
api.onState(receiveState)
api.onNavigateError(showNotice)
api.onDownloadStatus(showNotice)
api.state().then(receiveState)
