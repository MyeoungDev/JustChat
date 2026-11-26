# Floa

A separate Electron browser app in this repository, alongside Just Chat. It follows observed menu bar browser behavior and does not contain MenubarX source code or artwork.

Its compact UI uses a Chrome-inspired neutral light/dark palette and semantic tokens in `design-tokens.css`, documented in `DESIGN.md`. No component package is required.

## Run

From the repository root:

```sh
pnpm justbrowse:dev
```

Floa is a floating browser window shown above other apps and available from the Dock. Press `Option+G` to show or hide it from any app. Turn **Enable global shortcuts** off in Settings to release Floa's system-wide keys; its in-app shortcuts remain available while Floa is focused, and your assignments are preserved. `Option+Command+F` toggles whether it follows you across Spaces. `Option+Command+C` toggles Clean Mode, `Option+Command+P` toggles click-through, and `Option+Command+Comma/Period` adjusts window opacity. When click-through is on, use its global shortcut again to restore interaction. Save up to five window positions with `Option+Shift+Command+1–5`; recall them with `Option+Command+1–5`. Use `Option+Command+Arrow` to nudge the window and `Option+Command+0` to reset the layout. Name and manage the slots in Settings. The toolbar keeps navigation controls in its first row and shows action names such as **Favorite**, **Mute**, **Pin**, **Expand**, **Fill screen**, **Actions**, and **Hide** in its second row. Their labels update when an action is active (for example, **Unmute** or **Restore screen**). Hover or keyboard-focus a control to see its configured shortcut. Press `⌘,` to open Settings. `⌘⇧E` expands or restores the window, and `⌘⇧F` fills or restores the current screen; use Escape to exit Clean Mode or restore from screen fill. On Windows, use `Ctrl+Shift+E` and `Ctrl+Shift+F`. Change these shortcuts in Settings. Settings stays attached to the browser window; Escape returns to the browser.

## Browser features

- HTTPS browsing, configurable search, retained tabs, local session restore and start page
- Local browsing history with search, open in current/new tab, per-entry removal, and clear-all controls (`Command+Y` on Mac, `Ctrl+Y` on Windows)
- In-page text search with live match counts, next/previous navigation, and configurable `Command+F`
- Standalone floating Notes workspace (`Option+Command+N`) with automatic local saving, full-text note filtering (including on-device English/Korean OCR for pasted images), duplication, rich text, lists, highlight/color, and configurable note shortcuts
- In-place settings view in the floating window
- Expand/restore and screen-fill controls with configurable shortcuts
- Editable and reorderable start page favorites with named folders and folder filtering
- Per-tab User-Agent, viewport profiles (Desktop, iPhone SE, iPhone 16, iPad, Pixel 9), auto-refresh and zoom
- Configurable tab limit and idle WebContents discard policy
- Detachable tabs that remember each detached window's size and position, plus a dedicated website app window
- Download history with pause, cancel, resume attempts, progress and reveal-in-Finder actions
- Floating local video player with playback position restore, saved volume, global mute/volume shortcuts (`Option+Command+O`, `Option+Command+M`, `Option+Command+-`, `Option+Command+=`), and display-sleep prevention while playing
- Experimental Window Mirror with user-selected live previews, per-window stop controls, a stop-all action, and macOS opt-in Interact mode for pointer, scroll, and keyboard input; `⌘T` adds a source, `⌘W` stops the active mirror, Screen Recording is used for capture, and Accessibility is checked only when Interact or Open Original is requested. The native helper is placed in `Contents/Helpers` so macOS signing tools can identify it as nested helper code.
- Per-site notification, location, camera and microphone prompts; all start blocked. Websites never receive screen capture access; Window Mirror captures only a window the user explicitly chooses.
- Confirmed origin-scoped site data clearing
- `justbrowse://open/?url=...&width=...&height=...` validated deep links (`menubrowser://` remains as a compatibility alias)

## Book Reader

Open Book Reader with **Option+Command+R** or from the browser menu. Import PDF, EPUB, TXT, Markdown, RTF, or HTML documents into a local library. The reader stores a copy in the Floa profile and remembers the last reading position, zoom, and mode. PDF pages render on demand to limit memory use; PDF, EPUB, and text document search are available from the reader toolbar. Bookmarks and EPUB/text selections can be saved from the reader. Reader shortcuts can be changed in **Settings → Keyboard Shortcuts** and run only while the Reader window is focused.

The reader uses PDF.js and epub.js packages. Imported files stay on this Mac. Removing a library item deletes its local copy.

Downloads resume only where the remote server supports byte-range requests and supplies stable `ETag` and `Last-Modified` headers. An interrupted download may therefore restart or remain unavailable depending on server behavior.

## Packaging

The app uses its own builder config and icon resources, separate from Just Chat's installer configuration:

```sh
pnpm justbrowse:pack:mac
pnpm justbrowse:dist:mac
pnpm justbrowse:dist:win
```

Mac directory packaging creates an unsigned local `.app` for inspection. Release signing requires a valid `CSC_NAME` Developer ID Application identity; set `MENUBARX_REQUIRE_SIGNING=1` to make signing mandatory. Set `MENUBARX_NOTARIZE=1` and provide electron-builder's Apple notarization credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) to notarize. Windows signing can use electron-builder's standard `CSC_LINK` and `CSC_KEY_PASSWORD` certificate settings.

Floa keeps the existing **Just Browse** user data folder so saved tabs, settings, and site sessions stay in place. On first launch, any remaining **Menu Browser** profile is copied into that folder without overwriting files already present. Existing `menubrowser://` links continue to work alongside `justbrowse://`.

All implemented browser, Notes, Reader, local media, Window Mirror, workspace, and shortcut features are available without a plan, trial, or purchase gate. The tab limit is user-configurable in Settings and can be set to Unlimited.

### Local toolbar smoke check

With the Floa window visible and Orca installed, run `python3 tools/justbrowse-ui-smoke.py` from the repository root. The check toggles Pin, Mute, Maximize, and Fill screen in both directions, verifies each accessibility label, and restores each action to its initial state. It does not load a website or change saved browser data.
