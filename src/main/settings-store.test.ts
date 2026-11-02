import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../shared/settings'
import { SettingsStore } from './settings-store'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('settings persistence', () => {
  it('writes and restores shell preferences and both window geometries', () => {
    const directory = mkdtempSync(join(tmpdir(), 'just-chat-settings-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'data', 'settings.json')
    const store = new SettingsStore(path, 'darwin')
    const settings = defaultSettings('darwin')
    settings.autoHidePopover = true
    settings.geometry = {
      popover: { x: 20, y: 30, width: 900, height: 220 },
      expanded: { x: 40, y: 50, width: 1024, height: 768 }
    }
    store.save(settings)
    expect(store.load()).toEqual(settings)
    expect(readFileSync(path, 'utf8')).toContain('autoHidePopover')
  })

  it('falls back to platform defaults for missing or invalid data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'just-chat-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(join(directory, 'missing.json'), 'win32')
    expect(store.load()).toEqual(defaultSettings('win32'))
  })
})
