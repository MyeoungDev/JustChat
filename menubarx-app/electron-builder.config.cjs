const path = require('node:path')
const appDir = __dirname
const buildDir = path.join(appDir, 'build')
const signingRequested = process.env.MENUBARX_REQUIRE_SIGNING === '1'
const notarize = process.env.MENUBARX_NOTARIZE === '1'

module.exports = {
  appId: 'com.justchat.justbrowse',
  productName: 'Floa',
  directories: { app: appDir, buildResources: buildDir, output: path.resolve(__dirname, '../release/floa') },
  files: ['**/*', '!build/**', '!README.md', '!DESIGN.md', '!electron-builder.config.cjs'],
  asar: true,
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
    identity: process.env.CSC_NAME || undefined,
    forceCodeSigning: signingRequested,
    hardenedRuntime: signingRequested,
    gatekeeperAssess: false,
    ...(notarize ? { notarize: true } : {}),
    extendInfo: {
      NSCameraUsageDescription: 'Floa lets websites you approve use your camera.',
      NSMicrophoneUsageDescription: 'Floa lets websites you approve use your microphone.'
    }
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: path.join(buildDir, 'icon.ico') },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true }
}
