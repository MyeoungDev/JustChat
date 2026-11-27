(() => {
  const api = window.browserApp
  if (new URLSearchParams(location.search).has('embedded')) return
  const page = location.pathname.split('/').pop().replace('.html', '')
  const workspaceName = [
    ['browser', 'Browser', 'Browse websites', 'browser'],
    ['notes', 'Notes', 'Quick notes saved on this Mac', 'notes'],
    ['reader', 'Reader', 'Read local books and documents', 'reader']
  ]
  const workspaceIcons = {
    browser: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9h16.4M3.8 15h16.4M12 3.5c2.1 2.3 3.1 5.1 3.1 8.5s-1 6.2-3.1 8.5c-2.1-2.3-3.1-5.1-3.1-8.5S9.9 5.8 12 3.5Z"/>',
    notes: '<path d="M6 3.8h8l4 4v12.4H6zM14 3.8v4h4M9 12h6M9 15.5h6"/>',
    reader: '<path d="M12 6.2c-2.2-1.6-5.2-2-8-1.1v13.3c2.8-.9 5.8-.5 8 1.1m0-13.3c2.2-1.6 5.2-2 8-1.1v13.3c-2.8-.9-5.8-.5-8 1.1m0-13.3v13.3"/>'
  }
  const host = document.querySelector('#workspace-tabs') || document.createElement('nav')
  host.classList.add('workspace-tabs')
  host.setAttribute('aria-label', 'Floa workspaces')
  host.setAttribute('role', 'tablist')
  if (!host.isConnected) {
    host.classList.add('floa-app-tab-strip')
    host.setAttribute('aria-label', 'Browser and app tabs')
    document.body.classList.add(`floa-${page}-page`)
    document.body.prepend(host)
  }
  const button = (label, selected, action, title = label, icon = '') => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = `workspace-tab${selected ? ' active' : ''}`
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    tab.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End')
    tab.dataset.workspace = label.toLowerCase().replace(/\s+/g, '-')
    if (icon) {
      const glyph = document.createElement('span')
      glyph.className = 'workspace-tab-icon'
      glyph.setAttribute('aria-hidden', 'true')
      glyph.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${workspaceIcons[icon]}</svg>`
      tab.append(glyph)
    }
    const text = document.createElement('span')
    text.className = 'workspace-tab-label'
    text.textContent = label
    tab.append(text)
    tab.title = `${title}. Use Left or Right Arrow to switch workspaces.`
    tab.addEventListener('click', action)
    return tab
  }
  let lastRevision = -1
  const render = (state) => {
    if (!state) return
    const revision = Number.isFinite(state.revision) ? state.revision : 0
    if (revision < lastRevision) return
    lastRevision = revision
    const focusedTab = host.contains(document.activeElement) ? document.activeElement : null
    const focusKey = focusedTab?.dataset.browserTabId
      ? { key: 'browserTabId', value: focusedTab.dataset.browserTabId }
      : focusedTab?.dataset.workspace
        ? { key: 'workspace', value: focusedTab.dataset.workspace }
        : null
    host.replaceChildren()
    if (page !== 'index') {
      for (const item of state.tabs || []) {
        const label = item.title || (item.url ? (() => { try { return new URL(item.url).hostname } catch { return 'New Tab' } })() : 'New Tab')
        const browserTab = button(label, false, () => api.activateWorkspaceBrowserTab(item.id), item.url || label)
        browserTab.dataset.browserTabId = item.id
        host.append(browserTab)
      }
    }
    for (const [id, label, description, icon] of workspaceName) {
      host.append(button(label, state.workspace === id, () => api.switchWorkspace(id), description, icon))
    }
    if (focusKey) {
      const restored = [...host.children].find((tab) => tab.dataset[focusKey.key] === focusKey.value)
      restored?.focus()
    }
  }
  host.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = [...host.querySelectorAll('[role="tab"]')]
    const current = tabs.indexOf(document.activeElement)
    if (current < 0 || tabs.length < 2) return
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    event.preventDefault()
    tabs[next].focus()
    tabs[next].click()
  })
  api.workspaceState().then(render)
  api.onState(render)
})()
