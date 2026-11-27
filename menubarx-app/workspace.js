(() => {
  const api = window.browserApp
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
  const standalone = !host.isConnected
  host.classList.add('workspace-tabs')
  host.setAttribute('aria-label', standalone ? 'Browser and app tabs' : 'Floa workspaces')
  host.setAttribute('role', 'tablist')
  let browserTabs = host
  let workspaceTabs = host
  if (standalone) {
    host.classList.add('floa-app-tab-strip')
    document.body.classList.add(`floa-${page}-page`)
    host.setAttribute('role', 'group')
    browserTabs = document.createElement('div')
    browserTabs.className = 'workspace-browser-tabs'
    browserTabs.setAttribute('role', 'tablist')
    browserTabs.setAttribute('aria-label', 'Browser tabs')
    const newTabButton = document.createElement('button')
    newTabButton.type = 'button'
    newTabButton.className = 'workspace-new-tab'
    newTabButton.textContent = '+'
    newTabButton.title = 'New browser tab'
    newTabButton.setAttribute('aria-label', 'New browser tab')
    newTabButton.addEventListener('click', () => { void api.newTab() })
    workspaceTabs = document.createElement('div')
    workspaceTabs.className = 'workspace-switcher'
    workspaceTabs.setAttribute('role', 'tablist')
    workspaceTabs.setAttribute('aria-label', 'Floa workspaces')
    host.append(browserTabs, newTabButton, workspaceTabs)
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
  let lastActiveTabId = ''
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
    if (standalone) {
      const browserScrollLeft = browserTabs.scrollLeft
      browserTabs.replaceChildren()
      for (const [index, item] of (state.tabs || []).entries()) {
        const label = item.title || (item.url ? (() => { try { return new URL(item.url).hostname } catch { return 'New Tab' } })() : 'New Tab')
        const browserTab = document.createElement('div')
        browserTab.className = `workspace-browser-tab${item.id === state.activeTabId ? ' active' : ''}`
        const selectTab = document.createElement('button')
        selectTab.type = 'button'
        selectTab.className = 'workspace-browser-select'
        selectTab.setAttribute('role', 'tab')
        selectTab.setAttribute('aria-selected', String(item.id === state.activeTabId))
        selectTab.setAttribute('aria-label', `Switch to ${label}`)
        selectTab.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End')
        selectTab.tabIndex = item.id === state.activeTabId ? 0 : -1
        selectTab.dataset.browserTabId = item.id
        selectTab.title = item.url || label
        const title = document.createElement('span')
        title.className = 'workspace-browser-title'
        title.textContent = label
        selectTab.append(title)
        selectTab.addEventListener('click', () => api.activateWorkspaceBrowserTab(item.id))
        browserTab.append(selectTab)
        if ((state.tabs || []).length > 1) {
          const closeTab = document.createElement('button')
          closeTab.type = 'button'
          closeTab.className = 'workspace-browser-close'
          closeTab.textContent = '×'
          closeTab.title = `Close ${label}`
          closeTab.setAttribute('aria-label', `Close ${label}`)
          const focusId = item.id === state.activeTabId
            ? state.tabs[index === 0 ? 1 : index - 1]?.id
            : state.activeTabId
          if (focusId && focusId !== item.id) closeTab.dataset.browserTabId = focusId
          closeTab.addEventListener('click', () => { void api.closeTab(item.id) })
          browserTab.append(closeTab)
        }
        browserTabs.append(browserTab)
      }
      browserTabs.scrollLeft = browserScrollLeft
      if (state.activeTabId !== lastActiveTabId) {
        browserTabs.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    } else host.replaceChildren()
    lastActiveTabId = state.activeTabId || ''
    workspaceTabs.replaceChildren()
    for (const [id, label, description, icon] of workspaceName) {
      workspaceTabs.append(button(label, state.workspace === id, () => api.switchWorkspace(id), description, icon))
    }
    if (focusKey) {
      const restored = [...host.querySelectorAll('button')].find((tab) => tab.dataset[focusKey.key] === focusKey.value)
      restored?.focus()
    }
  }
  host.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tablist = event.target.closest('[role="tablist"]')
    if (!tablist || !host.contains(tablist)) return
    const tabs = [...tablist.querySelectorAll('[role="tab"]')]
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
