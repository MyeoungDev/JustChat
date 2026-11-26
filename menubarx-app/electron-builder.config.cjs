const path = require('node:path')
const { mkdirSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const appDir = __dirname
const buildDir = path.join(appDir, 'build')
const mirrorInputHelper = path.resolve(appDir, '../out/FloaMirrorInput')
const signingRequested = process.env.MENUBARX_REQUIRE_SIGNING === '1'
const notarize = process.env.MENUBARX_NOTARIZE === '1'

module.exports = {
  appId: 'com.justchat.justbrowse',
  productName: 'Floa',
  directories: { app: appDir, buildResources: buildDir, output: path.resolve(__dirname, '../release/floa') },
  files: ['**/*', '!build/**', '!README.md', '!DESIGN.md', '!electron-builder.config.cjs'],
  asar: true,
  beforePack: async (context) => {
    if (context.electronPlatformName !== 'darwin') return
    mkdirSync(path.dirname(mirrorInputHelper), { recursive: true })
    const result = spawnSync('swiftc', ['-O', '-framework', 'ApplicationServices', '-framework', 'CoreGraphics', path.join(appDir, 'FloaMirrorInput.swift'), '-o', mirrorInputHelper], { encoding: 'utf8' })
    if (result.error || result.status !== 0) throw new Error(`Could not build Floa Mirror input helper: ${result.error?.message || result.stderr || result.status}`)
  },
  asarUnpack: [
    'node_modules/tesseract.js/**',
    'node_modules/tesseract.js-core/**',
    'node_modules/bmp-js/**',
    'node_modules/is-url/**',
    'node_modules/regenerator-runtime/**',
    'node_modules/wasm-feature-detect/**'
  ],
  mac: {
    category: 'public.app-category.utilities',
    target: ['dmg', 'zip'],
    icon: path.join(buildDir, 'icon.icns'),
    extraFiles: [{ from: mirrorInputHelper, to: 'Helpers/FloaMirrorInput' }],
    identity: process.env.CSC_NAME || undefined,
    forceCodeSigning: signingRequested,
    hardenedRuntime: signingRequested,
    gatekeeperAssess: false,
    ...(notarize ? { notarize: true } : {}),
    extendInfo: {
      NSCameraUsageDescription: 'Floa lets websites you approve use your camera.',
      NSMicrophoneUsageDescription: 'Floa lets websites you approve use your microphone.',
      NSScreenCaptureUsageDescription: 'Floa captures only the app window you select for Window Mirror. Input is sent to that window only when you turn on Interact.'
    }
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: path.join(buildDir, 'icon.ico') },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true }
}
