const requireSignedRelease = process.env.JUST_CHAT_REQUIRE_SIGNING === '1'

module.exports = {
  appId: 'com.myeoungdev.justchat',
  productName: 'Just Chat',
  asar: true,
  publish: null,
  directories: {
    output: 'release',
    buildResources: 'assets'
  },
  files: [
    'out/**/*',
    'assets/icon.png',
    '!**/*.map'
  ],
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  forceCodeSigning: requireSignedRelease,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: true
  },
  mac: {
    icon: 'icon.icns',
    category: 'public.app-category.productivity',
    identity: requireSignedRelease ? undefined : '-',
    hardenedRuntime: requireSignedRelease,
    notarize: requireSignedRelease,
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] }
    ]
  },
  win: {
    icon: 'icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  }
}
