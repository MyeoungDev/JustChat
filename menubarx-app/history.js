const api = window.historyApp
const root = document.querySelector('#entries')
const query = document.querySelector('#query')
let entries = []
document.querySelector('kbd').textContent = api.platform === 'darwin' ? '⌘ Y' : 'Ctrl+Y'

function dateGroupLabel(timestamp, now = new Date()) {
  const date = new Date(timestamp)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((today - entryDay) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

function render() {
  const text = query.value.trim().toLocaleLowerCase()
  const filtered = entries.filter((entry) => !text || `${entry.title}\n${entry.url}`.toLocaleLowerCase().includes(text))
  root.replaceChildren()
  if (!filtered.length) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = text ? 'No matching history' : 'No browsing history yet'
    root.append(empty)
    return
  }
  const groups = new Map()
  for (const entry of filtered) {
    const label = dateGroupLabel(entry.visitedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(entry)
  }
  for (const [label, groupEntries] of groups) {
    const group = document.createElement('section')
    group.className = 'day-group'
    const heading = document.createElement('h2')
    heading.textContent = label
    group.append(heading)
    for (const entry of groupEntries) {
      const row = document.createElement('article')
      row.className = 'entry'
      const main = document.createElement('div')
      main.className = 'entry-main'
      const title = document.createElement('div')
      title.className = 'entry-title'
      title.textContent = entry.title || entry.url
      const url = document.createElement('div')
      url.className = 'entry-url'
      url.textContent = entry.url
      main.append(title, url)
      const time = document.createElement('time')
      time.dateTime = new Date(entry.visitedAt).toISOString()
      time.textContent = new Date(entry.visitedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      const actions = document.createElement('div')
      actions.className = 'entry-actions'
      const addAction = (label, action, className = '') => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = label
        button.className = className
        button.addEventListener('click', async () => {
          const result = await api.action(entry.id, action)
          if (result?.error) button.title = result.error
        })
        actions.append(button)
      }
      addAction('Open', 'open', 'open')
      addAction('New tab', 'open-new-tab')
      addAction('Remove', 'remove', 'remove')
      row.append(main, time, actions)
      group.append(row)
    }
    root.append(group)
  }
}

api.onState((state) => { entries = Array.isArray(state) ? state : []; render() })
api.state().then((state) => { entries = Array.isArray(state) ? state : []; render() })
query.addEventListener('input', render)
document.querySelector('#clear-history').addEventListener('click', async () => {
  if (!entries.length || !window.confirm('Clear all browsing history from this Mac?')) return
  await api.action('', 'clear')
})
