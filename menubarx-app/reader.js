import * as pdfjs from './node_modules/pdfjs-dist/build/pdf.mjs'

const $ = (id) => document.getElementById(id)
const els = Object.fromEntries(['import', 'empty-import', 'library-search', 'library', 'bookmarks', 'highlights', 'previous', 'next', 'document-title', 'document-meta', 'search-form', 'search-query', 'search-count', 'zoom', 'mode', 'bookmark', 'highlight', 'remove-document', 'empty', 'loading', 'reader-viewport', 'pdf-pages', 'epub-viewer', 'text-viewer', 'message'].map((id) => [id, $(id)]))
let documents = []
let current = null
let pdf = null
let book = null
let saveTimer = 0
let messageTimer = 0
let scrollObserver = null
let pageRenderObserver = null
let activePage = 1
let textSearch = []
let textSearchIndex = -1
let pdfSearch = []
let epubSearch = []
let searchGeneration = 0
let isRestoring = false
let documentLoadGeneration = 0
let pdfSelection = null

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

function notify(text) {
  els.message.textContent = text
  els.message.hidden = !text
  clearTimeout(messageTimer)
  if (text) messageTimer = setTimeout(() => { els.message.hidden = true }, 3000)
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function renderLibrary() {
  const query = els['library-search'].value.trim().toLocaleLowerCase()
  els.library.replaceChildren()
  const matches = documents.filter((item) => {
    if (!query) return true
    const searchableText = [
      item.title,
      item.type,
      ...(item.bookmarks || []).flatMap((entry) => [entry?.label, entry?.text]),
      ...(item.highlights || []).map((entry) => entry?.text)
    ].filter((value) => typeof value === 'string').join('\n').toLocaleLowerCase()
    return searchableText.includes(query)
  })
  for (const item of matches) {
    const button = document.createElement('button')
    button.className = 'library-item'
    button.setAttribute('aria-current', String(item.id === current?.id))
    const title = document.createElement('strong'); title.textContent = item.title
    const meta = document.createElement('small'); meta.textContent = `${item.type.toUpperCase()} · ${item.type === 'pdf' ? `Page ${item.lastPage || 1}` : new Date(item.updatedAt).toLocaleDateString()}`
    button.append(title, meta)
    button.addEventListener('click', () => openDocument(item.id))
    els.library.append(button)
  }
  if (!matches.length) {
    const empty = document.createElement('p'); empty.className = 'library-empty'; empty.textContent = query ? 'No matching documents' : 'Your library is empty'
    els.library.append(empty)
  }
  renderAnnotations()
}

function renderAnnotations() {
  for (const [container, entries, kind] of [[els.bookmarks, current?.bookmarks || [], 'bookmark'], [els.highlights, current?.highlights || [], 'highlight']]) {
    container.replaceChildren()
    for (const entry of entries) {
      const wrapper = document.createElement('div'); wrapper.className = 'annotation-entry'
      const jump = document.createElement('button'); jump.className = 'sidebar-entry'; jump.title = entry.label || entry.text || ''
      const title = document.createElement('strong'); title.textContent = entry.label || entry.text || `${kind === 'bookmark' ? 'Page' : 'Highlight'} ${entry.page || ''}`
      const meta = document.createElement('small'); meta.textContent = entry.page ? `Page ${entry.page}` : new Date(entry.createdAt).toLocaleString()
      jump.append(title, meta)
      jump.addEventListener('click', () => jumpToAnnotation(kind, entry))
      const remove = document.createElement('button'); remove.className = 'annotation-remove'; remove.textContent = '×'; remove.title = `Remove ${kind}`; remove.setAttribute('aria-label', `Remove ${kind}`)
      remove.addEventListener('click', async () => {
        if (!current) return
        if (kind === 'bookmark') await window.readerApp.removeBookmark(current.id, entry.id)
        else {
          const documentId = current.id
          const removed = await window.readerApp.removeHighlight(documentId, entry.id)
          if (!removed || current?.id !== documentId) return
          els['pdf-pages'].querySelectorAll('.pdf-saved-highlight').forEach((mark) => {
            if (mark.dataset.highlightId === entry.id) mark.remove()
          })
          const cfi = entry.cfi || entry.location
          if (current.type === 'epub' && cfi && book?.rendition) {
            try { book.rendition.annotations.remove(cfi, 'highlight') } catch {}
          }
        }
      })
      wrapper.append(jump, remove); container.append(wrapper)
    }
  }
}

function clearViewer() {
  documentLoadGeneration += 1
  searchGeneration += 1; textSearch = []; pdfSearch = []; epubSearch = []; textSearchIndex = -1
  pdfSelection = null; window.__readerSelection = null
  els.highlight.disabled = !current
  clearTimeout(saveTimer); saveTimer = 0
  scrollObserver?.disconnect(); scrollObserver = null
  pageRenderObserver?.disconnect(); pageRenderObserver = null
  if (book) { try { book.destroy() } catch {} }
  if (pdf) { try { pdf.destroy() } catch {} }
  pdf = null; book = null
  els['pdf-pages'].replaceChildren(); els['epub-viewer'].replaceChildren(); els['text-viewer'].replaceChildren()
}

function setDocumentChrome(doc) {
  current = doc
  els['document-title'].textContent = doc?.title || 'Your library'
  els['document-meta'].textContent = doc ? `${doc.type.toUpperCase()} · ${doc.bookmarks?.length || 0} bookmarks · ${doc.highlights?.length || 0} highlights` : 'Import a PDF, EPUB, or text document to begin.'
  els.empty.hidden = Boolean(doc)
  els['reader-viewport'].hidden = !doc
  els.loading.hidden = !doc
  els.zoom.value = String(doc?.zoom || 1)
  els.mode.textContent = doc?.mode === 'scroll' ? 'Scroll' : 'Paged'
  els.mode.setAttribute('aria-pressed', String(doc?.mode === 'scroll'))
  for (const button of [els.previous, els.next, els.bookmark, els.highlight, els['remove-document'], els.zoom]) button.disabled = !doc
  els.mode.disabled = !doc || ['txt', 'md', 'rtf', 'html'].includes(doc.type)
  renderLibrary()
}

function saveLocationSoon(extra = {}) {
  if (!current || isRestoring) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const location = book?.rendition?.currentLocation?.()?.start?.cfi || ''
    void window.readerApp.saveLocation(current.id, { location, page: activePage, zoom: Number(els.zoom.value), mode: els['reader-viewport'].classList.contains('paged') ? 'paged' : 'scroll', ...extra })
  }, 350)
}

function showType(type) {
  for (const [key, name] of [['pdf-pages', 'pdf'], ['epub-viewer', 'epub'], ['text-viewer', 'text']]) els[key].hidden = key !== `${type}-viewer` && !(type === 'pdf' && key === 'pdf-pages')
  els['reader-viewport'].classList.toggle('paged', current?.mode !== 'scroll')
}

function scrollReaderElement(element, behavior = 'auto', align = 'start') {
  if (!element) return false
  const viewport = els['reader-viewport']
  const viewportRect = viewport.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const offset = align === 'center' ? (viewportRect.height - elementRect.height) / 2 : 0
  viewport.scrollTo({ top: viewport.scrollTop + elementRect.top - viewportRect.top - offset, behavior })
  return true
}

function scrollToPdfPage(pageNumber, behavior = 'auto') {
  return scrollReaderElement(els['pdf-pages'].querySelector(`[data-page="${pageNumber}"]`), behavior)
}

function findTextRanges(container, query) {
  const needle = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  if (!needle) return []
  const nodes = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node
  let raw = ''
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: raw.length })
    raw += node.nodeValue || ''
  }
  let normalized = ''
  const offsets = []
  let pendingSpace = null
  for (let index = 0; index < raw.length; index += 1) {
    if (/\s/.test(raw[index])) {
      if (normalized && pendingSpace === null) pendingSpace = index
      continue
    }
    if (pendingSpace !== null) { normalized += ' '; offsets.push(pendingSpace); pendingSpace = null }
    normalized += raw[index].toLocaleLowerCase(); offsets.push(index)
  }
  const locate = (offset, end = false) => {
    const item = nodes.find((entry) => end
      ? offset > entry.start && offset <= entry.start + entry.node.nodeValue.length
      : offset >= entry.start && offset < entry.start + entry.node.nodeValue.length)
    return item ? { node: item.node, offset: offset - item.start } : null
  }
  const ranges = []
  let from = 0
  while ((from = normalized.indexOf(needle, from)) >= 0) {
    const start = locate(offsets[from]); const end = locate(offsets[from + needle.length - 1] + 1, true)
    if (start && end) { const range = document.createRange(); range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset); ranges.push(range) }
    from += needle.length
  }
  return ranges
}

function renderPdfHighlights(textLayer, highlights) {
  for (const highlight of highlights || []) {
    for (const range of findTextRanges(textLayer, highlight.text || '').slice(0, 20)) {
      for (const rect of range.getClientRects()) {
        const layerRect = textLayer.getBoundingClientRect()
        const mark = document.createElement('span')
        mark.className = 'pdf-saved-highlight'
        mark.dataset.highlightId = highlight.id || ''
        mark.style.left = `${rect.left - layerRect.left}px`; mark.style.top = `${rect.top - layerRect.top}px`
        mark.style.width = `${rect.width}px`; mark.style.height = `${rect.height}px`
        mark.style.backgroundColor = highlight.color || '#fff1a6'
        textLayer.append(mark)
      }
    }
  }
}

function applyEpubHighlight(rendition, highlight) {
  if (!rendition || !highlight?.location) return false
  try {
    rendition.annotations.highlight(highlight.location, {}, null, 'reader-saved-highlight', {
      fill: highlight.color || '#fff1a6',
      'fill-opacity': '0.55'
    })
    return true
  } catch { return false }
}

document.addEventListener('selectionchange', () => {
  if (current?.type !== 'pdf') return
  const selection = getSelection()
  const selectedLayer = selection?.anchorNode?.parentElement?.closest('.pdf-text-layer')
  const page = selectedLayer?.closest('.pdf-page')
  const text = selection?.toString()?.trim().slice(0, 2000) || ''
  pdfSelection = page && text ? { page: Number(page.dataset.page), text, range: selection.getRangeAt(0).cloneRange() } : null
  els.highlight.disabled = !pdfSelection
})

async function searchEpubBook(targetBook, query, generation, documentId) {
  const results = []
  for (const section of targetBook.spine.spineItems) {
    if (generation !== searchGeneration || book !== targetBook || current?.id !== documentId) return null
    try {
      await section.load(targetBook.load.bind(targetBook))
      if (generation !== searchGeneration || book !== targetBook || current?.id !== documentId) return null
      results.push(...section.find(query))
    } finally { if (typeof section.unload === 'function') section.unload() }
  }
  return results
}

async function renderPdf(data, doc, generation) {
  showType('pdf')
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: new URL('./node_modules/pdfjs-dist/cmaps/', import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('./node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('./node_modules/pdfjs-dist/wasm/', import.meta.url).href,
  })
  const parsedPdf = await loadingTask.promise
  if (generation !== documentLoadGeneration) { void parsedPdf.destroy(); return }
  pdf = parsedPdf
  const fragment = document.createDocumentFragment()
  const pageObjects = new Map()
  const pageCount = parsedPdf.numPages
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (generation !== documentLoadGeneration) return
    const page = await parsedPdf.getPage(pageNumber)
    if (generation !== documentLoadGeneration) return
    const viewport = page.getViewport({ scale: Number(els.zoom.value) })
    const section = document.createElement('section'); section.className = 'pdf-page'; section.dataset.page = String(pageNumber)
    section.style.width = `${viewport.width}px`; section.style.height = `${viewport.height}px`
    pageObjects.set(pageNumber, { page, viewport, rendering: null }); fragment.append(section)
  }
  els['pdf-pages'].append(fragment)
  els['document-meta'].textContent = `PDF · ${pageCount} pages · ${doc.bookmarks?.length || 0} bookmarks`
  const renderPage = async (section) => {
    if (generation !== documentLoadGeneration || pdf !== parsedPdf) return
    const number = Number(section.dataset.page); const entry = pageObjects.get(number)
    if (!entry || entry.rendering || section.querySelector('canvas')) return
    const canvas = document.createElement('canvas'); const context = canvas.getContext('2d', { alpha: false })
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.ceil(entry.viewport.width * ratio); canvas.height = Math.ceil(entry.viewport.height * ratio)
    canvas.style.width = `${entry.viewport.width}px`; canvas.style.height = `${entry.viewport.height}px`
    const textLayer = document.createElement('div'); textLayer.className = 'pdf-text-layer'
    textLayer.style.setProperty('--total-scale-factor', String(entry.viewport.scale * (entry.viewport.userUnit || 1)))
    textLayer.style.setProperty('--scale-round-x', '1px'); textLayer.style.setProperty('--scale-round-y', '1px')
    section.append(canvas, textLayer)
    entry.rendering = Promise.all([
      entry.page.render({ canvasContext: context, canvas, viewport: entry.viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] }).promise,
      entry.page.getTextContent().then((textContent) => new pdfjs.TextLayer({ textContentSource: textContent, container: textLayer, viewport: entry.viewport }).render())
    ]).then(() => { if (generation === documentLoadGeneration && pdf === parsedPdf) renderPdfHighlights(textLayer, (doc.highlights || []).filter((highlight) => Number(highlight.page) === number)) })
      .catch((error) => { canvas.remove(); if (generation === documentLoadGeneration) notify(error.message || 'Could not render this PDF page.') })
      .finally(() => { entry.rendering = null })
    await entry.rendering
  }
  pageRenderObserver = new IntersectionObserver((entries) => {
    if (generation !== documentLoadGeneration || pdf !== parsedPdf) return
    for (const entry of entries) {
      const section = entry.target
      if (entry.isIntersecting) void renderPage(section)
      else if (!entry.target.matches(`[data-page="${activePage}"]`)) { section.querySelector('canvas')?.remove(); section.querySelector('.pdf-text-layer')?.remove() }
    }
  }, { root: els['reader-viewport'], rootMargin: '1000px 0px' })
  els['pdf-pages'].querySelectorAll('.pdf-page').forEach((page) => pageRenderObserver.observe(page))
  scrollObserver = new IntersectionObserver((entries) => {
    if (generation !== documentLoadGeneration || pdf !== parsedPdf) return
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    if (visible) { activePage = Number(visible.target.dataset.page); saveLocationSoon() }
  }, { root: els['reader-viewport'], threshold: [0.25, 0.5, 0.75] })
  els['pdf-pages'].querySelectorAll('.pdf-page').forEach((page) => scrollObserver.observe(page))
  const targetPage = Math.max(1, Math.min(pageCount, doc.lastPage || 1))
  scrollToPdfPage(targetPage)
  activePage = targetPage
}

async function renderEpub(data, doc, generation) {
  showType('epub')
  const loadedBook = window.ePub(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  book = loadedBook
  const rendition = loadedBook.renderTo(els['epub-viewer'], { width: '100%', height: '100%', flow: doc.mode === 'scroll' ? 'scrolled-doc' : 'paginated', spread: 'none', allowScriptedContent: false })
  const foreground = getComputedStyle(document.documentElement).getPropertyValue('--color-fg-primary').trim() || '#202124'
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-layer-1').trim() || '#ffffff'
  rendition.themes.default({ body: { color: foreground, background: surface, 'font-family': 'Georgia, serif', 'line-height': '1.7' }, '::selection': { background: '#8ebfff' } })
  rendition.on('relocated', (location) => {
    if (generation !== documentLoadGeneration || book !== loadedBook || !location?.start) return
    activePage = location.start.displayed?.page || location.start.index + 1
    els['document-meta'].textContent = `EPUB · ${activePage} / ${book.spine?.length || '—'} · ${doc.bookmarks?.length || 0} bookmarks`
    saveLocationSoon({ location: location.start.cfi })
  })
  rendition.on('selected', (cfiRange, contents) => {
    if (generation !== documentLoadGeneration || book !== loadedBook) return
    const selection = contents?.window?.getSelection?.()?.toString()?.trim()
    if (!selection) return
    window.__readerSelection = { cfi: cfiRange, text: selection.slice(0, 2000) }
    els.highlight.disabled = false
    notify('Text selected. Choose Highlight to save it.')
  })
  await rendition.display(doc.lastLocation || undefined)
  if (generation !== documentLoadGeneration || book !== loadedBook) return
  for (const entry of doc.highlights || []) applyEpubHighlight(rendition, entry)
}

function markdownToHtml(source) {
  const lines = source.replace(/\r/g, '').split('\n'); const out = []; let list = ''
  const closeList = () => { if (list) { out.push(`</${list}>`); list = '' } }
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line)
    if (heading) { closeList(); const level = heading[1].length; out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`) }
    else if (bullet || ordered) { const next = ordered ? 'ol' : 'ul'; if (list !== next) { closeList(); list = next; out.push(`<${list}>`) } out.push(`<li>${inlineMarkdown((bullet || ordered)[1])}</li>`) }
    else if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`) }
    else if (line.trim()) { closeList(); out.push(`<p>${inlineMarkdown(line)}</p>`) }
    else closeList()
  }
  closeList(); return out.join('')
}

function inlineMarkdown(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>')
}

function sanitizeHtml(source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  parsed.querySelectorAll('script,style,iframe,object,embed,form,link,meta,svg,video,audio').forEach((node) => node.remove())
  parsed.body.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || (attr.name === 'href' && !/^(https?:|mailto:|#)/i.test(attr.value)) || (attr.name === 'src' && !/^data:image\//i.test(attr.value))) node.removeAttribute(attr.name)
    }
  })
  return parsed.body.innerHTML
}

async function renderText(data, doc) {
  showType('text')
  els['reader-viewport'].classList.remove('paged')
  els.mode.textContent = 'Scroll'
  const source = new TextDecoder().decode(data)
  if (doc.type === 'html') els['text-viewer'].innerHTML = sanitizeHtml(source)
  else if (doc.type === 'md') els['text-viewer'].innerHTML = markdownToHtml(source)
  else if (doc.type === 'rtf') els['text-viewer'].innerHTML = `<pre>${escapeHtml(source.replace(/\\par[d]?\b/g, '\n').replace(/\\'[0-9a-f]{2}/gi, ' ').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, ''))}</pre>`
  else els['text-viewer'].innerHTML = source.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
  els['text-viewer'].style.fontSize = `${17 * Number(els.zoom.value)}px`
  if (doc.lastLocation) { const top = Number(doc.lastLocation); if (Number.isFinite(top)) els['reader-viewport'].scrollTop = top }
  els['document-meta'].textContent = `${doc.type.toUpperCase()} · ${source.length.toLocaleString()} characters · ${doc.bookmarks?.length || 0} bookmarks`
  els['reader-viewport'].onscroll = () => saveLocationSoon({ location: String(els['reader-viewport'].scrollTop) })
}

async function openDocument(id) {
  const doc = documents.find((item) => item.id === id)
  if (!doc) return
  clearViewer(); const generation = documentLoadGeneration; isRestoring = true; setDocumentChrome(doc); activePage = doc.lastPage || 1
  try {
    const result = await window.readerApp.loadDocument(id)
    if (generation !== documentLoadGeneration) return
    if (!result || result.error) throw new Error(result?.error || 'Could not load this document.')
    const data = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data)
    if (doc.type === 'pdf') await renderPdf(data, doc, generation)
    else if (doc.type === 'epub') await renderEpub(data, doc, generation)
    else await renderText(data, doc)
    if (generation !== documentLoadGeneration) return
    els.loading.hidden = true
    renderLibrary()
    if (els['search-query'].value.trim()) updateTextSearch(els['search-query'].value)
  } catch (error) {
    if (generation === documentLoadGeneration) { notify(error.message || 'Could not open document.'); els.loading.hidden = true }
  } finally { if (generation === documentLoadGeneration) isRestoring = false }
}

function refreshState(state) {
  documents = Array.isArray(state) ? state : []
  const currentId = current?.id
  current = documents.find((item) => item.id === currentId) || current
  renderLibrary()
  if (current) { els['document-meta'].textContent = `${current.type.toUpperCase()} · ${current.bookmarks?.length || 0} bookmarks · ${current.highlights?.length || 0} highlights`; renderAnnotations() }
}

async function importDocument() {
  const result = await window.readerApp.importDocument()
  if (result?.error) return notify(result.error)
  const state = await window.readerApp.state(); refreshState(state)
  if (result?.id) await openDocument(result.id)
}

async function stepPage(direction) {
  if (!current) return
  if (pdf) {
    const max = pdf.numPages; const next = Math.max(1, Math.min(max, activePage + direction))
    scrollToPdfPage(next, 'smooth'); activePage = next; saveLocationSoon({ page: next }); return
  }
  if (book?.rendition) { await book.rendition[direction < 0 ? 'prev' : 'next'](); return }
  els['reader-viewport'].scrollBy({ top: direction * els['reader-viewport'].clientHeight * 0.85, behavior: 'smooth' })
}

function updateTextSearch(query) {
  const generation = ++searchGeneration
  textSearch = []; textSearchIndex = -1
  pdfSearch = []; epubSearch = []
  const q = query.trim().toLocaleLowerCase()
  if (!q || !current) { els['search-count'].textContent = ''; return }
  if (pdf) {
    const searchablePdf = pdf
    const documentId = current.id
    els['search-count'].textContent = 'Searching…'
    void (async () => {
      const matches = []
      for (let pageNumber = 1; pageNumber <= searchablePdf.numPages; pageNumber += 1) {
        if (generation !== searchGeneration || pdf !== searchablePdf || current?.id !== documentId) return
        const page = await searchablePdf.getPage(pageNumber)
        if (generation !== searchGeneration || pdf !== searchablePdf || current?.id !== documentId) return
        const content = await page.getTextContent()
        if (generation !== searchGeneration || pdf !== searchablePdf || current?.id !== documentId) return
        const value = content.items.map((item) => item.str || '').join(' ').toLocaleLowerCase()
        let offset = 0; let count = 0
        while ((offset = value.indexOf(q, offset)) >= 0) { count += 1; offset += Math.max(1, q.length) }
        if (count) matches.push({ page: pageNumber, count })
      }
      if (generation !== searchGeneration || current?.id !== documentId) return
      pdfSearch = matches; textSearchIndex = matches.length ? 0 : -1
      els['search-count'].textContent = matches.length ? `${matches.reduce((sum, item) => sum + item.count, 0)} found` : 'No matches'
      if (matches.length) { activePage = matches[0].page; scrollToPdfPage(activePage, 'smooth') }
    })().catch((error) => { if (generation === searchGeneration) { els['search-count'].textContent = 'Search failed'; notify(error.message || 'Could not search this PDF.') } })
    return
  }
  if (book?.rendition) {
    const searchableBook = book
    const documentId = current.id
    els['search-count'].textContent = 'Searching…'
    void searchEpubBook(searchableBook, q, generation, documentId).then(async (results) => {
      if (generation !== searchGeneration || book !== searchableBook) return
      epubSearch = results || []; textSearchIndex = epubSearch.length ? 0 : -1
      if (epubSearch[0]) await searchableBook.rendition.display(epubSearch[0].cfi)
      if (generation !== searchGeneration || book !== searchableBook) return
      els['search-count'].textContent = epubSearch.length ? `${epubSearch.length} found` : 'No matches'
    }).catch((error) => { if (generation === searchGeneration && book === searchableBook) { els['search-count'].textContent = 'Search failed'; notify(error.message || 'Could not search this EPUB.') } })
    return
  }
  const walker = document.createTreeWalker(els['text-viewer'], NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const value = node.nodeValue.toLocaleLowerCase(); let index = value.indexOf(q)
    while (index >= 0) { textSearch.push({ node, index, length: q.length }); index = value.indexOf(q, index + q.length) }
  }
  els['search-count'].textContent = textSearch.length ? `${textSearch.length} found` : 'No matches'
  moveTextSearch(1)
}

function moveTextSearch(direction) {
  if (pdfSearch.length) {
    textSearchIndex = (textSearchIndex + direction + pdfSearch.length) % pdfSearch.length
    const match = pdfSearch[textSearchIndex]; activePage = match.page
    scrollToPdfPage(match.page, 'smooth')
    els['search-count'].textContent = `${textSearchIndex + 1} / ${pdfSearch.length} pages`; return
  }
  if (epubSearch.length) {
    textSearchIndex = (textSearchIndex + direction + epubSearch.length) % epubSearch.length
    void book?.rendition?.display(epubSearch[textSearchIndex].cfi)
    els['search-count'].textContent = `${textSearchIndex + 1} / ${epubSearch.length}`; return
  }
  if (!textSearch.length) return
  textSearchIndex = (textSearchIndex + direction + textSearch.length) % textSearch.length
  const match = textSearch[textSearchIndex]; const range = document.createRange(); range.setStart(match.node, match.index); range.setEnd(match.node, match.index + match.length)
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); scrollReaderElement(match.node.parentElement, 'smooth', 'center')
  els['search-count'].textContent = `${textSearchIndex + 1} / ${textSearch.length}`
}

async function jumpToAnnotation(kind, entry) {
  if (!current) return
  if ((entry.cfi || (kind === 'highlight' && entry.location?.startsWith('epubcfi('))) && book?.rendition) { await book.rendition.display(entry.cfi || entry.location); return }
  if (entry.page && pdf) { activePage = entry.page; scrollToPdfPage(entry.page, 'smooth'); return }
  if (kind === 'bookmark' && entry.location && book?.rendition) await book.rendition.display(entry.location)
  else if (entry.location && Number.isFinite(Number(entry.location))) els['reader-viewport'].scrollTop = Number(entry.location)
}

async function addBookmark() {
  if (!current) return
  const location = book?.rendition?.currentLocation?.()?.start?.cfi || String(els['reader-viewport'].scrollTop)
  const result = await window.readerApp.addBookmark(current.id, { location, page: activePage, label: `Page ${activePage}` })
  if (result) notify('Bookmark saved.')
}

async function addHighlight() {
  if (!current) return
  const selected = window.__readerSelection
  if (selected?.cfi && current.type === 'epub') {
    const documentId = current.id
    const rendition = book?.rendition
    const saved = await window.readerApp.addHighlight(documentId, { location: selected.cfi, text: selected.text, color: '#ffe58a' })
    if (current?.id !== documentId || book?.rendition !== rendition) return
    if (!saved) { notify('This highlight is already saved.'); return }
    const applied = applyEpubHighlight(rendition, saved)
    for (const contents of rendition?.getContents?.() || []) contents.window?.getSelection?.()?.removeAllRanges()
    window.__readerSelection = null
    els.highlight.disabled = true
    notify(applied ? 'Highlight saved.' : 'Highlight saved in the sidebar; this EPUB page could not display it.')
    return
  }
  if (current.type === 'pdf' && pdfSelection) {
    const saved = pdfSelection
    const location = `pdf:${saved.page}:${encodeURIComponent(saved.text.slice(0, 160))}`
    const result = await window.readerApp.addHighlight(current.id, { location, text: saved.text, page: saved.page, color: '#ffe58a' })
    if (result) renderPdfHighlights(els['pdf-pages'].querySelector(`[data-page="${saved.page}"] .pdf-text-layer`), [result])
    getSelection()?.removeAllRanges(); pdfSelection = null; els.highlight.disabled = true
    notify(result ? 'Highlight saved.' : 'This highlight is already saved.')
    return
  }
  const selection = getSelection()?.toString()?.trim()
  if (!selection) return notify('Select text first, then choose Highlight.')
  const id = `text-${Date.now()}`
  await window.readerApp.addHighlight(current.id, { text: selection.slice(0, 2000), location: String(els['reader-viewport'].scrollTop), page: activePage, color: '#ffe58a', id })
  notify('Saved selected text. Text highlights are kept in the sidebar.')
}

function changeZoom(value) {
  if (!current) return
  const zoom = Math.min(2.5, Math.max(0.6, Number(value)))
  if (pdf) { const page = activePage; const id = current.id; current.zoom = zoom; void openDocument(id).then(() => { scrollToPdfPage(page); activePage = page }) }
  else if (book?.rendition) book.rendition.themes.fontSize(`${Math.round(100 * zoom)}%`)
  else els['text-viewer'].style.fontSize = `${17 * zoom}px`
  saveLocationSoon({ zoom })
}

async function toggleMode() {
  if (!current) return
  current.mode = current.mode === 'scroll' ? 'paged' : 'scroll'
  els['reader-viewport'].classList.toggle('paged', current.mode === 'paged')
  els.mode.textContent = current.mode === 'scroll' ? 'Scroll' : 'Paged'
  if (book?.rendition) { const cfi = book.rendition.currentLocation()?.start?.cfi; await book.rendition.flow(current.mode === 'scroll' ? 'scrolled-doc' : 'paginated'); if (cfi) await book.rendition.display(cfi) }
  saveLocationSoon({ mode: current.mode })
}

els.import.addEventListener('click', importDocument); els['empty-import'].addEventListener('click', importDocument)
els['library-search'].addEventListener('input', renderLibrary)
els.previous.addEventListener('click', () => stepPage(-1)); els.next.addEventListener('click', () => stepPage(1))
els.bookmark.addEventListener('click', addBookmark); els.highlight.addEventListener('click', addHighlight); els.mode.addEventListener('click', toggleMode)
els.zoom.addEventListener('change', () => changeZoom(els.zoom.value))
els['remove-document'].addEventListener('click', async () => { if (!current) return; const id = current.id; clearViewer(); setDocumentChrome(null); await window.readerApp.removeDocument(id); current = null; notify('Removed from this library.') })
els['search-form'].addEventListener('submit', (event) => { event.preventDefault(); updateTextSearch(els['search-query'].value) })
els['search-query'].addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); moveTextSearch(-1) } else if (event.key === 'Enter' && textSearch.length) { event.preventDefault(); moveTextSearch(1) } })
window.readerApp.onState(refreshState)
window.readerApp.onCommand((command) => {
  if (command === 'open') void importDocument()
  else if (command === 'search') els['search-query'].focus()
  else if (command === 'previous') void stepPage(-1)
  else if (command === 'next') void stepPage(1)
  else if (command === 'zoom-in') changeZoom(Number(els.zoom.value) + 0.1)
  else if (command === 'zoom-out') changeZoom(Number(els.zoom.value) - 0.1)
  else if (command === 'zoom-reset') changeZoom(1)
  else if (command === 'bookmark') void addBookmark()
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.activeElement === els['search-query']) { els['search-query'].blur(); return }
  if (event.key === 'ArrowLeft' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) void stepPage(-1)
  if (event.key === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) void stepPage(1)
})
window.readerApp.state().then((state) => { refreshState(state); const recent = [...documents].sort((a, b) => b.updatedAt - a.updatedAt)[0]; if (recent) void openDocument(recent.id) })
