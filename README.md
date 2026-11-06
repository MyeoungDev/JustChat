# Just Chat

Just Chat is a small desktop window for opening ChatGPT while you work in another app. It loads ChatGPT's own website in an Electron window, so you use the same account, conversations, and web interface as you do in a browser.

## Why I built it

I used GPT Classic a lot because it made ChatGPT easy to reach while I worked. Over time, the app felt too heavy for that simple job, and support is expected to end. I started Just Chat to build a lighter replacement for the quick-chat workflow I relied on. I chose Electron so the same idea could work on both macOS and Windows, rather than being limited to a macOS-only app.

## Goal

Just Chat aims to make ChatGPT feel close at hand: open a small window with a shortcut, continue using ChatGPT's own interface and account, then get more room for a longer conversation. The long-term interaction I want is a compact start that grows into a comfortable conversation view when a chat begins. The current auto-growth signal is best-effort, and the app remains experimental while that flow is being verified.

**Status: experimental Alpha.** ChatGPT is the current product target. Login, network challenges, and some website interactions depend on ChatGPT and are not guaranteed by this app.

## What it does

- Opens ChatGPT directly in a compact **Quick Chat** window.
- Hides ChatGPT's empty-page welcome heading and suggestion chip in Quick Chat to leave more room for the composer.
- Lets you switch the same window between Quick Chat and Expanded, or fill the display, without reloading the ChatGPT view.
- Can grow Quick Chat into Expanded when Enter is pressed or ChatGPT navigates to a conversation. Enter is a best-effort signal: Electron cannot tell Just Chat which page control has focus.
- Opens the window on the display containing the mouse pointer and remembers window size and position by display and mode.
- Uses a Just Chat icon in the running app window and macOS Dock; macOS and Windows icon files are included under `assets/`.
- Hides an empty Quick Chat when focus moves to another app.
- Follows the system light or dark appearance for the Just Chat controls. ChatGPT's website appearance is controlled by ChatGPT.

### Window sizes

| Mode | Default size | Minimum size |
|---|---:|---:|
| Quick Chat | 520 × 200 | 480 × 180 |
| Expanded | 520 × 480 | 480 × 400 |
| Full Screen | Current display | — |

Saved custom sizes take precedence over the defaults. The operating system may impose practical limits on very small windows.

## Requirements

- macOS or Windows desktop environment
- Node.js 22.12 or newer
- pnpm 10 or newer

Packaged installers, code signing, and automatic updates are not available yet. Run the development build using the steps below.

## Run locally

```sh
git clone https://github.com/MyeoungDev/JustChat.git
cd JustChat
pnpm install
pnpm dev
```

Sign in to ChatGPT in the window if needed. Just Chat stores the website session in its own persistent Electron profile; it does not share browser cookies with Chrome or Safari.

## Use the app

- **Show or hide:** `Option+Space` on macOS; `Ctrl+Shift+Space` on Windows. This is the only system-wide shortcut by default. Change it in Settings if it conflicts with another app.
- **Quick Chat / Expanded:** Use the single size button to switch between the compact window and larger conversation window.
- **Full Screen:** Use the full-screen button to fill the current display.
- **ChatGPT zoom:** `Command+-` / `Command+plus` / `Command+0` on macOS, or `Ctrl+-` / `Ctrl+plus` / `Ctrl+0` on Windows, to zoom out, zoom in, or reset the ChatGPT page. This changes the website scale, not the outer Just Chat window.
- **Search conversations:** `Command+K` on macOS or `Ctrl+K` on Windows. This is ChatGPT's built-in web shortcut; Just Chat does not intercept or remap it.
- **Temporary chat:** `Command+Shift+N` on macOS or `Ctrl+Shift+N` on Windows. This focused Quick Chat shortcut clicks ChatGPT's own Temporary Chat control when it is available; it is configurable in Settings and is not registered globally.
- **Escape:** Hides Just Chat by default. This can be changed in Settings.

The compact window grows into Expanded on an unmodified Enter key or when ChatGPT creates a conversation route. The key signal may also respond to Enter in another page control, since Electron does not expose ChatGPT's focused element to the app. Sending with the mouse is detected when ChatGPT changes to a conversation route; existing website behavior may vary.

## Settings

- Configure the global show/hide shortcut and the focused temporary-chat shortcut. ChatGPT's built-in search shortcut remains owned by ChatGPT.
- Keep Just Chat above other windows.
- Adjust whole-window opacity from 60% to 100% (100% by default), or try experimental ChatGPT background-only opacity from 70% to 100%. The experiment keeps text and controls fully opaque; some ChatGPT surfaces may remain opaque.
- Adjust embedded page zoom from 70% to 120%. The default is 91%, approximately one Command− step below 100%; this changes provider page content, not the Just Chat frame.
- Reload ChatGPT to a fresh page after the window has been hidden for 15, 30, or 60 minutes, or disable the reset. The default is 30 minutes.
- Sign out of ChatGPT in Just Chat and clear its local website data. This does not delete conversations from the ChatGPT account or affect downloaded files.

## Development checks

```sh
pnpm typecheck
pnpm test
pnpm build
```

Run the app with opt-in timing and process samples:

```sh
pnpm dev:perf
```

Performance output goes to the terminal. It does not save URLs, prompts, or telemetry files.

## Privacy and security notes

- ChatGPT is shown in its own remote web view; Just Chat does not call a model API.
- The app does not extract or save conversation content locally.
- ChatGPT website data is stored persistently in Just Chat's Electron profile until you sign out and clear it in Settings.
- When a ChatGPT conversation is open, Just Chat stores only its URL path (without query parameters) in local Settings so it can reopen that conversation in the expanded window after a restart. Conversation contents are not copied into Just Chat's settings.
- The remote page runs without Node.js integration or an app preload, and web permissions are denied by default.
- Just Chat validates user-started top-level navigation and popup destinations against the provider host list. HTTPS redirect hops stay embedded so authentication flows can use identity hosts that change or are not known in advance; insecure redirects are blocked.

## Project layout

```text
src/main/       Electron window, provider view, shortcuts, and settings persistence
src/preload/    Narrow IPC bridge for the local shell
src/renderer/   React shell and settings UI
src/shared/     Provider policy, shortcuts, settings, geometry, and behavior helpers
docs/           Design, architecture, security, implementation status, and verification notes
```

## Project notes

- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Design](DESIGN.md)
- [Architecture review](docs/architecture-review.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Performance notes](docs/PERFORMANCE.md)
- [Verification checklist](docs/verification.md)
