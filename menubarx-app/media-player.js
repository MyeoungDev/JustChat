const api = window.mediaPlayer
const video = document.querySelector('#video')
const fileName = document.querySelector('#file-name')
const status = document.querySelector('#status')
const volume = document.querySelector('#volume')
const volumeValue = document.querySelector('#volume-value')
const muteButton = document.querySelector('#mute-video')
let currentPath = ''
let lastSavedAt = 0

function setVolume(value, muted = video.muted) {
  const normalized = Math.max(0, Math.min(1, Number(value)))
  video.volume = normalized
  video.muted = Boolean(muted)
  volume.value = String(normalized)
  volumeValue.value = `${Math.round(normalized * 100)}%`
  muteButton.textContent = video.muted || normalized === 0 ? 'Unmute' : 'Mute'
  muteButton.setAttribute('aria-pressed', String(video.muted))
}

function savePosition() {
  if (!currentPath || !Number.isFinite(video.currentTime)) return
  lastSavedAt = Date.now()
  api.savePosition(currentPath, video.currentTime)
}

api.onOpen((media) => {
  currentPath = media.filePath
  fileName.textContent = media.title
  document.title = `Floa · ${media.title}`
  status.textContent = ''
  lastSavedAt = 0
  setVolume(media.volume, media.muted)
  video.onloadedmetadata = () => {
    if (media.resumeAt > 0 && media.resumeAt < video.duration) video.currentTime = media.resumeAt
    status.textContent = media.resumeAt > 0 ? `Resumed at ${formatTime(media.resumeAt)}.` : ''
    void video.play().catch(() => { status.textContent = 'Press Play to start this video.' })
  }
  video.src = media.src
  video.load()
})

api.onVolume((state) => setVolume(state.volume, state.muted))
video.addEventListener('timeupdate', () => {
  if (Date.now() - lastSavedAt > 4000) savePosition()
})
video.addEventListener('seeked', savePosition)
video.addEventListener('pause', () => { savePosition(); api.setPlaying(false) })
video.addEventListener('play', () => { status.textContent = ''; api.setPlaying(true) })
video.addEventListener('ended', () => { savePosition(); api.setPlaying(false) })
video.addEventListener('error', () => { status.textContent = 'This video format or codec is not supported.'; api.setPlaying(false) })
volume.addEventListener('input', () => { void api.setVolume(Number(volume.value)) })
muteButton.addEventListener('click', async () => {
  const state = await api.toggleMute()
  if (state) setVolume(state.volume, state.muted)
})
document.querySelector('#open-video').addEventListener('click', () => { void api.chooseVideo() })
window.addEventListener('pagehide', () => {
  if (currentPath && Number.isFinite(video.currentTime)) api.savePositionSync(currentPath, video.currentTime)
  api.setPlaying(false)
})

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
