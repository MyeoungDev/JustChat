# Floa

A separate Electron browser app in this repository, alongside Just Chat. It follows observed menu bar browser behavior and does not contain MenubarX source code or artwork.

Its compact UI uses a Chrome-inspired neutral light/dark palette and semantic tokens in `design-tokens.css`, documented in `DESIGN.md`. No component package is required.

## Run

From the repository root:

```sh
pnpm justbrowse:dev
```

Floa is a floating browser window shown above other apps and available from the Dock. Press `Option+G` to show or hide it from any app, or `⌘/` to bring it forward and focus its address bar. Use `⌘⇧/` to open Settings at the shortcut list. Turn **Enable global shortcuts** off in Settings to release Floa's system-wide keys; its in-app shortcuts remain available while Floa is focused, and your assignments are preserved. `Option+Command+B/N/R` opens Browser, Notes, or Reader from any app; `Option+Command+Tab` and `Option+Shift+Command+Tab` cycle all Floa website and utility tabs. Inside Floa, `Control+Tab` and `Control+Shift+Tab` cycle those tabs too. The workspace strip also supports Left/Right Arrow and Home/End; keyboard focus stays on the selected tab while switching. All these mappings can be changed in Settings. Website tabs, the new-tab button, and three icon-only workspace switches share one compact tab row. `Option+Command+S` cycles Browser, Notes, and Reader. `Option+Command+F` toggles whether it follows you across Spaces. `Option+Command+C` toggles Clean Mode, `Option+Command+P` toggles click-through, and `Option+Command+Comma/Period` adjusts window opacity. When click-through is on, use its global shortcut again to restore interaction. Save up to five window positions with `Option+Shift+Command+1–5`; recall them with `Option+Command+1–5`. Use `Option+Command+Arrow` to nudge the window and `Option+Command+0` to reset the layout. Name and manage the slots in Settings. The toolbar keeps navigation, address/search, Favorite, and Actions in one compact row. Window size, screen fill, pin, mute, and hide commands are in Actions; configured shortcuts remain available. Press `⌘,` to open Settings. `⌘⇧E` expands or restores the window, and `⌘⇧F` fills or restores the current screen; use Escape to exit Clean Mode or restore from screen fill. On Windows, use `Ctrl+Shift+E` and `Ctrl+Shift+F`. Change these shortcuts in Settings. Settings stays attached to the browser window; Escape returns to the browser.

## Browser features

- HTTPS browsing, configurable search, retained tabs, local session restore and start page
- Website and utility tabs share one tab system. Browser tabs, the new-tab control, and the right-aligned Browser/Notes/Reader icon switcher share one compact row; selecting a website tab from a utility restores that Browser tab
- Local browsing history with search, open in current/new tab, per-entry removal, and clear-all controls (`Command+Y` on Mac, `Ctrl+Y` on Windows)
- In-page text search with live match counts, next/previous navigation, and configurable `Command+F`
- Notes workspace in the Floa window (`Option+Command+N`) with automatic local saving, full-text note filtering (including on-device English/Korean OCR for pasted images), duplication, rich text, lists, highlight/color, and configurable note shortcuts
- In-place settings view in the floating window
- Expand/restore and screen-fill controls with configurable shortcuts
- Editable and reorderable start page favorites with named folders and folder filtering
- Idle WebContents discard policy for inactive tabs
- Download history with pause, cancel, resume attempts, progress and reveal-in-Finder actions
- Floating local video player with playback position restore, saved volume, global mute/volume shortcuts (`Option+Command+O`, `Option+Command+M`, `Option+Command+-`, `Option+Command+=`), and display-sleep prevention while playing
- Per-site notification, location, camera and microphone prompts; all start blocked. Websites cannot request screen capture.
- Confirmed origin-scoped site data clearing

## Book Reader

Open Book Reader with **Option+Command+R** or from the workspace switcher. Import PDF, EPUB, TXT, Markdown, RTF, or HTML documents into a local library. The reader stores a copy in the Floa profile and remembers the last reading position, zoom, and mode. PDF pages render on demand to limit memory use; PDF, EPUB, and text document search are available from the reader toolbar. Bookmarks and EPUB/text selections can be saved from the reader. Reader shortcuts can be changed in **Settings → Keyboard Shortcuts** and run only while the Reader workspace is active.

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

Floa keeps the existing **Just Browse** user data folder so saved tabs, settings, and site sessions stay in place. On first launch, any remaining **Menu Browser** profile is copied into that folder without overwriting files already present.

All implemented browser, Notes, Reader, local media, workspace, and shortcut features are available without a plan, trial, or purchase gate.

### Local toolbar check

With the Floa window visible, open **Actions** and confirm window size, screen fill, pin, mute, and hide commands are available. Their configured shortcuts can be reviewed in Settings.
