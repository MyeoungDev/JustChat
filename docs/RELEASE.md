# Release and installation notes

## Current distribution state

- The project builds a macOS Apple Silicon DMG and ZIP, and a Windows x64 NSIS installer.
- GitHub Actions validates changes and builds platform artifacts when a `v*` tag is pushed. It creates a **draft** release only after both platform jobs succeed. A maintainer must review and manually publish it.
- The workflow does not use signing credentials. macOS artifacts are ad-hoc signed so the patched Apple Silicon binary can launch, but they are not Developer ID signed or notarized. Windows artifacts have no publisher signature.
- The app has no in-app automatic updater. Users install updates manually from GitHub Releases.
- Windows uninstall is configured to preserve the app's user data. Reinstalling or replacing the macOS app bundle also leaves its per-user application data in place.

## User installation

1. Open [GitHub Releases](https://github.com/MyeoungDev/JustChat/releases) and choose the latest published release.
2. Download the macOS Apple Silicon `.dmg`/`.zip` or Windows x64 `.exe` that matches your computer.
3. Compare the downloaded file with the platform's `SHA256SUMS-*.txt` release asset before opening it.
4. Because the artifacts are not signed by a trusted publisher or notarized, the OS may warn that the publisher is unknown or that the app is from an unidentified developer. Do not bypass a warning unless you intentionally trust the exact source and checksum.
5. To update, download and install the newer published release. Just Chat does not automatically download or install updates.

If an installer fails, include the app version, OS version, architecture, and sanitized error details in a GitHub issue. Never attach prompts, replies, cookies, account identifiers, or private conversation URLs.

## Maintainer release procedure

1. Confirm the Electron version is on a supported stable line. Electron currently supports its latest three stable major versions; its release schedule is upstream and changes over time.
2. Update `package.json` version and release notes. Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and both packaging jobs on their native runners.
3. Review the diff and create an annotated `vX.Y.Z` tag only after checks pass. Pushing a `v*` tag starts the draft workflow and creates a GitHub draft; it does not publish a public release.
4. Inspect both platform artifacts, app metadata, icons, SHA-256 files, and workflow logs. Verify that no secrets or user data appear.
5. Confirm code signing and notarization status. Trusted publisher signing is not configured. Do not describe ad-hoc macOS signatures as Developer ID signing or notarization.
6. Review the draft release notes and assets in GitHub. Publish manually only after the platform smoke checks and security review pass.

Signing keys, Apple notarization credentials, and Windows signing credentials must be stored only as narrowly scoped GitHub Actions secrets if configured later. Enable `JUST_CHAT_REQUIRE_SIGNING=1` only after a complete signing and notarization setup exists; the packaging configuration should then fail rather than silently create an unsigned signed-release candidate.

## Support targets and limits

Electron 45 supports Windows 10 or later and macOS 13 or later. Initial package architecture targets are Apple Silicon (`arm64`) and Windows x64. These are build targets, not a claim that every OS version or device has passed manual testing. Windows installation/runtime, signed builds, and authenticated provider flows still require platform verification.

ChatGPT integration depends on a changing third-party website and remains experimental. Just Chat is not affiliated with or endorsed by OpenAI. Review the upstream service terms and platform policies before each stable release.
