const api = window.notesApp
const list = document.querySelector('#note-list')
const title = document.querySelector('#note-title')
const editor = document.querySelector('#note-content')
const status = document.querySelector('#save-state')
const notice = document.querySelector('#notice')
const search = document.querySelector('#note-search')
document.querySelector('#text-color').value = matchMedia('(prefers-color-scheme: dark)').matches ? '#f5f5f5' : '#242424'
let notes = []
let activeId = ''
let timer
let saving = Promise.resolve()
let dirty = false
let savedRange = null
let editVersion = 0
let noteOcrQueue = Promise.resolve()
const indexedNoteVersions = new Map()
const noteOcrJobs = new Map()

const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'SPAN', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'A', 'IMG', 'DIV'])
function sanitizeHtml(html) {
  const template = document.createElement('template')
  template.innerHTML = String(html || '').slice(0, 2_000_000)
  for (const node of [...template.content.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'VIDEO', 'AUDIO', 'SVG', 'MATH'].includes(node.tagName)) { node.remove(); continue }
    if (node.tagName === 'FONT') {
      const span = document.createElement('span')
      const color = node.getAttribute('color')
      if (color && /^#[0-9a-f]{3,8}$/i.test(color)) span.style.color = color
      span.innerHTML = node.innerHTML
      node.replaceWith(span)
      continue
    }
    if (!allowedTags.has(node.tagName)) { node.replaceWith(...node.childNodes); continue }
    for (const attr of [...node.attributes]) {
      if (node.tagName === 'A' && attr.name === 'href') {
        try { const url = new URL(attr.value); if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) node.removeAttribute(attr.name) }
        catch { node.removeAttribute(attr.name) }
      } else if (node.tagName === 'IMG' && ['src', 'alt'].includes(attr.name)) {
        if (attr.name === 'src' && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)) node.removeAttribute(attr.name)
        if (attr.name === 'alt') node.setAttribute('alt', attr.value.slice(0, 200))
      } else if (node.tagName === 'IMG' && attr.name === 'data-ocr') {
        node.setAttribute('data-ocr', attr.value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 10_000))
      } else if (node.tagName === 'SPAN' && attr.name === 'style') {
        const safe = [...attr.value.matchAll(/(color|background-color)\s*:\s*(#[0-9a-f]{3,8}|rgb\([\d\s,]+\)|rgba\([\d\s.,]+\))/gi)]
        const style = safe.map((match) => `${match[1]}:${match[2]}`).join(';')
        if (style) node.setAttribute('style', style); else node.removeAttribute('style')
      } else node.removeAttribute(attr.name)
    }
  }
  normalizeListMarkup(template.content)
  return template.innerHTML
}

function normalizeListMarkup(root) {
  for (const list of [...root.querySelectorAll('ul, ol')]) {
    const paragraph = list.parentElement
    if (paragraph?.tagName !== 'P') continue
    const before = []
    const after = []
    let passedList = false
    for (const node of [...paragraph.childNodes]) {
      if (node === list) { passedList = true; continue }
      const siblings = passedList ? after : before
      siblings.push(node)
    }
    const replacement = []
    const addParagraph = (nodes) => {
      if (!nodes.some((node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim())) return
      const wrapper = document.createElement('p')
      nodes.forEach((node) => wrapper.append(node))
      replacement.push(wrapper)
    }
    addParagraph(before)
    replacement.push(list)
    addParagraph(after)
    paragraph.replaceWith(...replacement)
  }
}

function showNotice(message = '') { notice.textContent = message }
function scheduleSave() {
  editVersion += 1
  dirty = true
  status.textContent = 'Editing…'
  clearTimeout(timer)
  timer = setTimeout(() => { void saveCurrent() }, 350)
}
function saveCurrent() {
  clearTimeout(timer)
  if (!activeId || !dirty) return saving.then((result) => result !== false && !dirty)
  const content = sanitizeHtml(editor.innerHTML)
  if (content.length > 2_000_000) { status.textContent = 'Not saved'; showNotice('This note is too large. Remove some content or images before saving.'); return Promise.resolve(false) }
  const noteId = activeId
  const version = editVersion
  dirty = false
  const snapshot = { title: title.value, content }
  status.textContent = 'Saving…'
  saving = saving.then(async () => {
    const result = await api.update(noteId, snapshot)
    if (!result) { if (editVersion === version) dirty = true; status.textContent = 'Not saved'; showNotice('This note could not be saved.'); return false }
    const note = notes.find((item) => item.id === result.id)
    if (note) Object.assign(note, snapshot, { updatedAt: result.updatedAt })
    notes.sort((a, b) => b.updatedAt - a.updatedAt)
    if (editVersion === version) dirty = false
    status.textContent = dirty ? 'Editing…' : 'Saved'
    showNotice('')
    renderList()
    if (note) indexNoteImages(note)
    // A newer edit may have arrived while this snapshot was being written.
    // Callers that switch notes must not treat that older snapshot as a flush.
    return !dirty
  }).catch(() => { dirty = true; status.textContent = 'Not saved'; showNotice('Could not save this note. Try again.'); return false })
  return saving
}
function renderList() {
  list.replaceChildren()
  const query = search.value.trim().toLocaleLowerCase()
  const filtered = notes.filter((note) => !query || `${note.title} ${searchableText(note.content)}`.toLocaleLowerCase().includes(query))
  document.querySelector('#note-total').textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
  for (const note of filtered) {
    const button = document.createElement('button')
    button.className = 'note-row'
    button.type = 'button'
    button.setAttribute('aria-current', String(note.id === activeId))
    const heading = document.createElement('strong'); heading.textContent = note.title || 'Untitled'
    const summary = document.createElement('small'); summary.textContent = plainText(note.content).trim().slice(0, 72) || 'No additional text'
    button.append(heading, summary)
    button.addEventListener('click', () => { void selectNote(note.id) })
    list.append(button)
  }
  if (!filtered.length) { const empty = document.createElement('div'); empty.className = 'note-row'; empty.textContent = query ? 'No matching notes' : 'No notes'; list.append(empty) }
}
function plainText(html) { const div = document.createElement('div'); div.innerHTML = sanitizeHtml(html); return div.textContent || '' }
function searchableText(html) {
  const template = document.createElement('template')
  template.innerHTML = sanitizeHtml(html)
  return `${template.content.textContent || ''} ${[...template.content.querySelectorAll('img[data-ocr]')].map((image) => image.getAttribute('data-ocr') || '').join(' ')}`
}
function indexNoteImages(note) {
  if (!note?.id || indexedNoteVersions.get(note.id) === note.content) return
  if (noteOcrJobs.has(note.id)) {
    if (note.id === activeId) showNotice('Reading image text on this Mac for note search…')
    return
  }
  const originalContent = note.content
  const job = noteOcrQueue.then(async () => {
    const template = document.createElement('template')
    template.innerHTML = sanitizeHtml(originalContent)
    let changed = false
    for (const image of template.content.querySelectorAll('img[src]')) {
      if (image.hasAttribute('data-ocr')) continue
      const imageUrl = image.getAttribute('src')
      if (note.id === activeId) showNotice('Reading image text on this Mac for note search…')
      const result = await api.recognizeImage(imageUrl)
      if (result?.error) {
        if (note.id === activeId) showNotice(result.error)
        continue
      }
      image.setAttribute('data-ocr', result.text || '')
      changed = true
      if (note.id === activeId) showNotice(result.text ? 'Image text is ready to search.' : 'No readable text was found in this image.')
    }
    indexedNoteVersions.set(note.id, originalContent)
    if (!changed) return
    const current = notes.find((item) => item.id === note.id)
    if (!current || current.content !== originalContent) return
    const content = template.innerHTML
    if (note.id === activeId && !dirty && sanitizeHtml(editor.innerHTML) === originalContent) editor.innerHTML = content
    const saved = await api.update(note.id, { title: current.title, content })
    if (!saved) return
    Object.assign(current, saved)
    indexedNoteVersions.set(note.id, content)
    renderList()
  }).catch(() => {
    if (note.id === activeId) showNotice('Image text search could not be completed.')
  }).finally(() => {
    noteOcrJobs.delete(note.id)
    const current = notes.find((item) => item.id === note.id)
    if (current && current.content !== originalContent) indexNoteImages(current)
  })
  noteOcrQueue = job.catch(() => {})
  noteOcrJobs.set(note.id, job)
}
async function selectNote(id) {
  if (id === activeId) return
  if (!await saveCurrent()) return
  savedRange = null
  activeId = id
  dirty = false
  const note = notes.find((item) => item.id === id)
  if (!note) return
  title.value = note.title || 'Untitled'
  editor.innerHTML = sanitizeHtml(note.content)
  status.textContent = 'Saved'
  showNotice('')
  renderList()
  indexNoteImages(note)
}
async function createNote(sourceId) {
  if (!await saveCurrent()) return
  const note = await api.create(sourceId)
  if (!note || note.error) { showNotice(note?.error || 'Could not create a note.'); return }
  if (!notes.some((item) => item.id === note.id)) notes.unshift(note)
  activeId = note.id
  savedRange = null
  title.value = note.title
  editor.innerHTML = sanitizeHtml(note.content)
  dirty = false
  status.textContent = 'Saved'
  renderList()
  indexNoteImages(note)
  title.focus()
  title.select()
}
async function deleteCurrent() {
  if (!activeId || !window.confirm(`Delete “${title.value || 'Untitled'}”? This cannot be undone.`)) return
  if (!await saveCurrent()) return
  const next = await api.delete(activeId)
  notes = next || []
  activeId = ''
  if (notes[0]) await selectNote(notes[0].id)
  else await createNote()
}
function format(command, value = null) {
  editor.focus()
  const selection = window.getSelection()
  if (savedRange && selection) { selection.removeAllRanges(); selection.addRange(savedRange) }
  document.execCommand(command, false, value)
  if (command === 'insertUnorderedList' || command === 'insertOrderedList') normalizeListMarkup(editor)
  scheduleSave()
}

document.addEventListener('selectionchange', () => {
  const selection = window.getSelection()
  if (selection?.rangeCount && editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange()
})

document.querySelector('#new-note').addEventListener('click', () => { void createNote() })
document.querySelector('#duplicate-note').addEventListener('click', () => { void createNote(activeId) })
document.querySelector('#delete-note').addEventListener('click', () => { void deleteCurrent() })
title.addEventListener('input', scheduleSave)
editor.addEventListener('input', scheduleSave)
search.addEventListener('input', renderList)
document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('mousedown', (event) => event.preventDefault()))
document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => format(button.dataset.command, button.dataset.value || null)))
document.querySelector('#text-color').addEventListener('input', (event) => format('foreColor', event.target.value))
document.querySelector('#highlight-color').addEventListener('input', (event) => format('hiliteColor', event.target.value))
editor.addEventListener('paste', (event) => {
  const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith('image/'))
  if (imageItem) {
    event.preventDefault()
    const file = imageItem.getAsFile()
    if (!file || file.size > 1_000_000) { showNotice('Pasted images must be smaller than 1 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { format('insertHTML', `<img src="${String(reader.result)}" alt="Pasted image" />`); scheduleSave() }
    reader.readAsDataURL(file)
    return
  }
  event.preventDefault()
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
  scheduleSave()
})
editor.addEventListener('click', (event) => { if (event.target.closest('a')) event.preventDefault() })
api.onState((incoming) => {
  const selectedId = activeId
  notes = incoming || []
  notes.forEach(indexNoteImages)
  if (!activeId && notes[0]) void selectNote(notes[0].id)
  else if (selectedId && !notes.some((note) => note.id === selectedId) && notes[0]) void selectNote(notes[0].id)
  renderList()
})
api.onCommand((command) => {
  if (command === 'new') void createNote()
  else if (command === 'duplicate') void createNote(activeId)
  else if (command === 'save') void saveCurrent()
  else if (['bold', 'italic', 'underline'].includes(command)) format(command)
})
api.state().then((incoming) => { notes = incoming || []; notes.forEach(indexNoteImages); if (notes[0]) void selectNote(notes[0].id); renderList() })
window.addEventListener('beforeunload', () => { if (dirty && activeId) api.saveSync(activeId, { title: title.value, content: sanitizeHtml(editor.innerHTML) }) })
