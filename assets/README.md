# App icon assets

- `icon-source.png` is the original generated artwork (1254 × 1254, transparent corners).
- `icon.png` is the 1024 × 1024 runtime image used by the Electron window and macOS Dock.
- `icon.icns` contains the standard macOS icon sizes.
- `icon.ico` contains PNG-backed Windows sizes from 16 px through 256 px.
- `JustChat.iconset/` contains the macOS size variants used to build `icon.icns`.

When a packager is added, use `icon.icns` for macOS and `icon.ico` for Windows. This repository does not currently define a packaging configuration.
