# Architecture review — Just Chat Alpha

Date: 2026-11-02

## 1. Electron vs Tauri 2

**Decision for Alpha: Electron.** This remains a provisional choice for validating embedded third-party chat sites, not a claim that Electron has passed Provider compatibility tests.

Electron's `WebContentsView` is a first-party main-process view that can be attached to a window. Its session partitions make persistent per-provider profiles explicit. Those are direct matches for the highest-risk prototype requirements. Tauri 2 remains viable for a smaller native shell, but its web runtime is WKWebView on macOS and WebView2 on Windows, which means embedded-login, cookie, upload and rendering behavior must be checked independently on each OS. Tauri has webview/window APIs but this prototype has not validated detaching/reusing a remote view while changing presentation state.

The npm registry reported Electron 45.2.1, Vite 8.3.5, Vitest 5.0.5, React 19.3.1 and TypeScript 7.0.2 as latest stable at the time checked. Versions are pinned in `package.json` for reproducibility. Re-check release support and security advisories before shipping.

## 2. WebView and session management

- One `BrowserWindow` hosts the local React shell.
- Provider pages are separate `WebContentsView` objects. Each is created once, retained when inactive, and reattached to the same host window when selected.
- Each provider uses its own `persist:provider-<id>` session partition. Electron documents that a persistent partition is shared by app pages using the same name; different partition names therefore keep cookies and local storage apart.
- Hidden provider views stay resident to preserve page state. Memory reclamation/suspension is deliberately deferred until measurements show what is safe.
- No provider DOM scripting or chat-content persistence is used.

## 3. Window resizing architecture

Popover and expanded are two sizes/presentation modes of the same native `BrowserWindow`, not separate chat windows. The selected provider view remains the same `WebContentsView` instance while the host window changes dimensions. This avoids a deliberate reload on mode transition. Responsive provider pages can still change their own layout or scroll position when resized; preserving exact scroll position is not guaranteed.

The mode target sizes are 900×600 Pop Over (700×600 minimum) and 1200×800 Expanded desktop pixels; Full Screen covers the current display. Each resizable mode retains its own x/y/width/height bounds, restored and clamped to the active display work area. Mode changes ignore saved geometry from another display so expansion stays on the monitor containing the current window. The shell uses one BrowserWindow and one retained ChatGPT WebContentsView for all modes, and launches directly into the Provider interface. Default toggle shortcuts are `Alt+Space` on macOS and `Control+Shift+Space` on Windows. `Command+K` / `Control+K` forwards ChatGPT's native history search. A configurable hidden-window timer (default 30 minutes) reloads ChatGPT's start page; conversation history remains on ChatGPT and is accessed there. The settings UI also exposes always-on-top, popover auto-hide and Escape behavior.

## 4. Remote-content isolation

- Local shell: sandbox, context isolation, no Node integration, restrictive CSP, narrow preload bridge.
- Provider WebContentsViews: sandbox, context isolation, no Node integration/preload, web security enabled, insecure content disabled.
- Navigation: HTTPS only, allowlisted top-level provider/auth domains. Allowlisted authentication popups open in a secure child window using the same provider session; other HTTPS popups go to the system browser.
- Permissions default-deny. This may block optional provider features that ask for camera, microphone, clipboard or other permissions; granting any permission requires a specific product decision and test.
- IPC handlers are limited to shell controls and provider selection. Remote pages have no bridge to them.
- Login and redirect hosts are hypotheses in the initial allowlist. A blocked redirect should be investigated and added narrowly; do not solve it by allowing arbitrary domains or weakening Electron security settings.

Electron's security guidance explicitly recommends disabling Node integration, enabling context isolation and sandboxing, maintaining web security, setting CSP, using permission handlers, and handling window-open requests carefully. The Alpha follows those defaults and validates shell IPC sender/frame/origin. This is a baseline, not a completed security audit.

## 5. macOS and Windows differences

| Area | macOS | Windows |
|---|---|---|
| Shortcut | Cmd modifier; system/global shortcut conflicts and permission behavior to check | Ctrl modifier; shell/application shortcut conflicts to check |
| Web runtime | Chromium bundled with Electron; provider may detect embedded browser | Same Electron Chromium build; file dialogs and shell integration differ |
| Window chrome | Frameless floating window and Spaces/mission-control behavior need visual checks | Frameless window, taskbar/Alt-Tab and DPI scaling need checks |
| Packaging | Signing/notarization and Apple Silicon/Intel artifacts | Code signing, installer and WebView-independent Chromium distribution |
| Position/scale | Multiple displays, Retina scaling and work-area behavior | Mixed-DPI monitors, taskbar work area and display changes |

The current implementation uses Electron APIs intended to be cross-platform, but none of these behaviors has yet been validated on Windows or a second display.

## 6. Impossible or unverified requirements

- **Exact page-state preservation through resize:** same WebContents avoids reload, but provider-controlled responsive layout can change scroll or focused input state. Exact preservation cannot be promised without site-specific scripting, which is intentionally excluded.
- **Embedded login acceptance:** providers can reject embedded Chromium or require system-browser/OAuth behavior. Never bypass those restrictions. Compatibility is unknown until manually tested.
- **Login redirects and allowed hosts:** actual redirect chains can change by region/account. The initial host lists are not compatibility certifications.
- **Uploads/downloads:** Electron can display file inputs in remote pages, but provider behavior, OS dialogs and download policy need manual tests. Camera/microphone/clipboard permissions are denied by default.
- **Provider switch continuity:** inactive views are retained in memory in this prototype, but provider behavior, background throttling and memory growth require measurement.
- **Cross-platform memory target and 300 ms response targets:** not measured. Several full AI websites can dominate application memory.
- **Terms and policies:** provider terms, account policies and embedded browser treatment need review before public release.

## References

- [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Electron Session and persistent partitions](https://www.electronjs.org/docs/latest/api/session)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Tauri 2 WebviewWindow API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/)
- [Electron npm release](https://www.npmjs.com/package/electron)
- [Vite npm release](https://www.npmjs.com/package/vite)
- [Vitest npm release](https://www.npmjs.com/package/vitest)
- [electron-vite dependency handling](https://electron-vite.org/guide/dependency-handling)
- [electron-vite development and preload sandboxing](https://electron-vite.org/guide/dev)
