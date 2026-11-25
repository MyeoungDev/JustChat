const api = window.downloadsApp
const root = document.querySelector('#items')
const bytes = (value) => { if (!value) return '0 B'; const units = ['B','KB','MB','GB']; let n = value, i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ } return `${n.toFixed(i ? 1 : 0)} ${units[i]}` }
function render(items = []) {
  root.replaceChildren()
  if (!items.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No downloads yet'; root.append(empty); return }
  for (const item of items) {
    const row = document.createElement('article'); row.className = 'download'
    const title = document.createElement('div'); title.className = 'title'; title.textContent = item.filename || item.url
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${item.state} · ${bytes(item.receivedBytes)}${item.totalBytes ? ` of ${bytes(item.totalBytes)}` : ''}${item.speed ? ` · ${bytes(item.speed)}/s` : ''}`
    const bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', `${item.filename || 'Download'} progress`); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, Number(item.percent) || 0)))); const fill = document.createElement('i'); fill.style.width = `${Math.max(0, Math.min(100, Number(item.percent) || 0))}%`; bar.append(fill)
    const actions = document.createElement('div'); actions.className = 'actions'
    const add = (label, action, enabled = true) => { const button = document.createElement('button'); button.textContent = label; button.disabled = !enabled; button.addEventListener('click', async () => { const result = await api.action(item.id, action); if (result?.error) meta.textContent = result.error }); actions.append(button) }
    if (item.canPause) add('Pause', 'pause')
    if (item.canResume) add('Resume', 'resume')
    if (item.live && item.state !== 'completed') add('Cancel', 'cancel')
    if (item.path) add('Show in Folder', 'show', item.state === 'completed')
    row.append(title, meta, bar, actions); root.append(row)
  }
}
api.onState(render)
api.state().then(render)
document.querySelector('#refresh').addEventListener('click', () => api.state().then(render))
