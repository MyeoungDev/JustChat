# Verification plan and current evidence

## Automated checks

Run:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Current unit coverage includes settings normalization and persistence, shortcut registration/conflict rollback, retained Provider-view reuse, sender/origin checks, HTTPS-only external links and Provider navigation, and window geometry transitions/clamping.

## Manual checks by platform

Use a clean app data directory per OS, then record OS version, Electron version, Provider, date and result. Do not enter credentials in automated tests.

1. Start Just Chat; verify the compact Just Chat composer appears instead of the ChatGPT page.
2. Sign in normally. Quit and relaunch; verify login persists.
3. Start a conversation, resize/expand/collapse, and verify the page did not reload and the conversation remains present. Record any scroll/focus changes.
4. Type a harmless prompt in the Just Chat composer and send it. Confirm a fresh ChatGPT conversation opens and receives the text. If transfer fails, confirm the draft remains and the manual-open action copies it for pasting.
4. Switch to Claude, sign in, start a conversation, then return to ChatGPT. Verify cookies and conversation state remain Provider-specific.
5. Test Provider file upload with a harmless local file and confirm the native chooser opens. Record supported file types and result.
6. Click an HTTPS external link; confirm it opens in the system browser. Try a non-HTTPS popup/navigation and confirm it is blocked.
7. Confirm camera, microphone and geolocation permission requests are denied.
8. Toggle the global shortcut while another app has focus; test hide/show, focus, and conflicts.
9. In a signed-in ChatGPT session, press `Command+Shift+N` and confirm ChatGPT enters Temporary mode. Confirm that a temporary conversation does not appear in chat history after leaving it.
10. Start a regular conversation, hide Just Chat, wait through the configured 30-minute timer, and confirm ChatGPT returns to a fresh page. Press `Command+K`, find the previous conversation and confirm it can be continued. Repeat with reset disabled to confirm the active page is retained.
11. Check the 900×220 Pop Over, Expanded and Full Screen modes on each display. Verify the same in-progress conversation remains loaded through each transition.
12. Move the popover to another display, quit, relaunch and check position restoration. Repeat with mixed scaling on Windows and Retina on macOS.
11. Measure idle and per-Provider resident memory with system tools after a fixed warm-up period; compare with one and two initialized Providers.

## Current evidence

- TypeScript checks: passed.
- Vitest: 7 files, 20 tests passed.
- Production build: passed.
- macOS development smoke: app launched and rendered its shell; unauthenticated ChatGPT load was observed. No GUI automation was available for interaction checks.
- Opt-in short performance sample (`pnpm dev:perf`): shell-ready 487.7 ms; unauthenticated ChatGPT page load 531.2 ms; sampled aggregate process working set was about 650 MiB. This is a brief development observation, not a release benchmark or idle-memory claim. See [PERFORMANCE.md](PERFORMANCE.md).
- Live Provider login, upload, restart persistence, global shortcut interaction, cross-platform window behavior and sustained memory remain unverified.
