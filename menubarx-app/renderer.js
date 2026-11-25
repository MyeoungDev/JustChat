const api = window.browserApp
const tabsNode = document.querySelector('#tabs')
const newTabButton = document.querySelector('#new-tab')
const address = document.querySelector('#address')
const homeAddress = document.querySelector('#home-address')
const home = document.querySelector('#home')
let state = { tabs: [], bookmarks: [], activeTabId: null, pinned: false, muted: false, canGoBack: false, canGoForward: false }
let noticeTimer
let editingBookmarkUrl = ''

async function newTab() {
  const result = await api.newTab()
  if (result?.error) showNotice(result.error)
}

function render() {
  tabsNode.replaceChildren()
  for (const tab of state.tabs) {
    const button = document.createElement('div')
    const active = tab.id === state.activeTabId
    button.className = `tab${active ? ' active' : ''}`
    button.setAttribute('role', 'group')
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
    if (tab.detached) button.classList.add('detached')
    if (tab.discarded) button.classList.add('discarded')
    const detach = document.createElement('button')
    detach.className = 'tab-detach'
    detach.type = 'button'
    detach.textContent = tab.detached ? '↙' : '↗'
    detach.title = tab.detached ? 'Return tab to Just Browse' : 'Detach tab to a window'
    detach.setAttribute('aria-label', detach.title)
    detach.addEventListener('click', (event) => { event.stopPropagation(); api.toggleTabDetachment(tab.id) })
    button.append(detach)
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
  const active = state.tabs.find((tab) => tab.id === state.activeTabId)
  address.value = active?.url || ''
  document.querySelector('#back').disabled = !state.canGoBack
  document.querySelector('#forward').disabled = !state.canGoForward
  document.querySelector('#pin').classList.toggle('active', state.pinned)
  document.querySelector('#mute').classList.toggle('active', state.muted)
  document.querySelector('#mute').title = state.muted ? 'Unmute website audio' : 'Mute website audio'
  home.hidden = Boolean(active?.url)
  renderBookmarks()
}

newTabButton.addEventListener('click', () => newTab())

function renderBookmarks() {
  const container = document.querySelector('#bookmarks')
  container.replaceChildren()
  if (!state.bookmarks.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-bookmarks'
    empty.textContent = 'Your favorite sites will appear here. Open a site and select ☆ to save it.'
    container.append(empty)
    return
  }
  for (const item of state.bookmarks) {
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
      control.setAttribute('aria-label', label)
      control.textContent = glyph
      control.addEventListener('click', (event) => { event.stopPropagation(); action() })
      actions.append(control)
    }
    tile.append(button, actions)
    container.append(tile)
  }
}

function editFavorite(item = null) {
  editingBookmarkUrl = item?.url || ''
  document.querySelector('#bookmark-dialog-title').textContent = item ? 'Edit favorite' : 'Add favorite'
  document.querySelector('#favorite-title').value = item?.title || ''
  document.querySelector('#favorite-url').value = item?.url || ''
  document.querySelector('#favorite-icon').value = item?.icon || ''
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
document.querySelector('#bookmark').addEventListener('click', () => api.addBookmark())
document.querySelector('#pin').addEventListener('click', () => api.togglePin())
document.querySelector('#mute').addEventListener('click', () => api.toggleMute())
document.querySelector('#menu-button').addEventListener('click', () => api.showMenu())
document.querySelector('#hide').addEventListener('click', () => api.hide())
document.querySelector('#add-favorite').addEventListener('click', () => editFavorite())
document.querySelector('#cancel-favorite').addEventListener('click', () => document.querySelector('#bookmark-editor').close())
document.querySelector('#bookmark-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const result = await api.saveBookmark({ originalUrl: editingBookmarkUrl, title: document.querySelector('#favorite-title').value, url: document.querySelector('#favorite-url').value, icon: document.querySelector('#favorite-icon').value })
  if (result?.error) { showNotice(result.error); return }
  document.querySelector('#bookmark-editor').close()
})
api.onState((next) => { state = next; render() })
api.onNavigateError(showNotice)
api.onDownloadStatus(showNotice)
api.state().then((next) => { state = next; render() })
