const path = require('node:path')
const appDir = __dirname
const buildDir = path.join(appDir, 'build')
const signingRequested = process.env.MENUBARX_REQUIRE_SIGNING === '1'
const notarize = process.env.MENUBARX_NOTARIZE === '1'

module.exports = {
  appId: 'com.justchat.justbrowse',
  productName: 'Just Browse',
  directories: { app: appDir, buildResources: buildDir, output: path.resolve(__dirname, '../release/just-browse') },
  files: ['**/*', '!build/**', '!README.md', '!DESIGN.md', '!electron-builder.config.cjs'],
  asar: true,
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
      NSCameraUsageDescription: 'Just Browse lets websites you approve use your camera.',
      NSMicrophoneUsageDescription: 'Just Browse lets websites you approve use your microphone.'
    }
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: path.join(buildDir, 'icon.ico') },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true }
}
