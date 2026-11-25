# Just Browse

A separate Electron browser app in this repository, alongside Just Chat. It follows observed menu bar browser behavior and does not contain MenubarX source code or artwork.

Its compact UI uses the semantic token approach from [Fluent 2](https://fluent2.microsoft.design/design-tokens/), adapted in `design-tokens.css` and documented in `DESIGN.md`. No Fluent component package is required.

## Run

From the repository root:

```sh
pnpm justbrowse:dev
```

Click the menu bar icon or press `Option+X` to show or hide Just Browse. Press `⌘,` to open Settings. It overlays the menu bar panel in panel mode and opens as a focused modal attached to the browser in Standard app window mode; use **Back to Browser** or Escape to return. Choose **Standard app window** to show a regular app window in the Dock/taskbar.

## Browser features

- HTTPS browsing, configurable search, retained tabs, local session restore and start page
- In-place settings view in the floating window
- Editable and reorderable start page favorites
- Per-tab User-Agent, viewport profiles (Desktop, iPhone SE, iPhone 16, iPad, Pixel 9), auto-refresh and zoom
- Configurable tab limit and idle WebContents discard policy
- Detachable tabs and a dedicated website app window
- Download history with pause, cancel, resume attempts, progress and reveal-in-Finder actions
- Per-site notification, location, camera and microphone prompts; all start blocked. Screen capture remains blocked.
- Confirmed origin-scoped site data clearing
- `justbrowse://open/?url=...&width=...&height=...` validated deep links (`menubrowser://` remains as a compatibility alias)

Downloads resume only where the remote server supports byte-range requests and supplies stable `ETag` and `Last-Modified` headers. An interrupted download may therefore restart or remain unavailable depending on server behavior.

## Packaging

The app uses its own builder config and icon resources, separate from Just Chat's installer configuration:

```sh
pnpm justbrowse:pack:mac
pnpm justbrowse:dist:mac
pnpm justbrowse:dist:win
```

Mac directory packaging creates an unsigned local `.app` for inspection. Release signing requires a valid `CSC_NAME` Developer ID Application identity; set `MENUBARX_REQUIRE_SIGNING=1` to make signing mandatory. Set `MENUBARX_NOTARIZE=1` and provide electron-builder's Apple notarization credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) to notarize. Windows signing can use electron-builder's standard `CSC_LINK` and `CSC_KEY_PASSWORD` certificate settings.

The first launch after renaming copies the previous **Menu Browser** profile into the **Just Browse** profile location without overwriting files already present. Existing `menubrowser://` links continue to work alongside `justbrowse://`.
