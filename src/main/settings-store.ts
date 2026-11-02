import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { normalizeSettings, type AppSettings } from '../shared/settings'

export class SettingsStore {
  constructor(private readonly path: string, private readonly platform: string) {}

  load(): AppSettings {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      return normalizeSettings(parsed, this.platform)
    } catch {
      return normalizeSettings(null, this.platform)
    }
  }

  save(settings: AppSettings): void {
    mkdirSync(dirname(this.path), { recursive: true })
    const tempPath = `${this.path}.${process.pid}.tmp`
    writeFileSync(tempPath, JSON.stringify(settings, null, 2), { mode: 0o600 })
    renameSync(tempPath, this.path)
  }
}
