import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const releaseDirectory = process.argv[2] ?? 'release'
const label = process.argv[3]
const appPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const artifactPrefix = `Just Chat-${appPackage.version}-`
const extensionsByPlatform = {
  macos: new Set(['.dmg', '.zip']),
  windows: new Set(['.exe'])
}

if (!label || !extensionsByPlatform[label]) {
  throw new Error('Usage: node scripts/write-checksums.mjs <directory> <macos|windows>')
}

const entries = await readdir(releaseDirectory)
const stagingDirectory = join(releaseDirectory, `artifacts-${label}`)
const artifacts = []
await mkdir(stagingDirectory, { recursive: true })

for (const entry of entries.sort()) {
  const sourcePath = join(releaseDirectory, entry)
  if (!(await stat(sourcePath)).isFile()
    || !entry.startsWith(artifactPrefix)
    || !extensionsByPlatform[label].has(entry.slice(entry.lastIndexOf('.')).toLowerCase())) continue

  const stagedPath = join(stagingDirectory, basename(entry))
  await copyFile(sourcePath, stagedPath)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(stagedPath)) hash.update(chunk)
  artifacts.push(`${hash.digest('hex')}  ${basename(entry)}`)
}

if (artifacts.length === 0) {
  throw new Error(`No release artifacts found in ${releaseDirectory}`)
}

await writeFile(join(stagingDirectory, `SHA256SUMS-${label}.txt`), `${artifacts.join('\n')}\n`)
