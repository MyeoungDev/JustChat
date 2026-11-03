# Verification plan and current evidence

## Automated checks

Run:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Current unit coverage includes settings normalization and persistence, shortcut registration/conflict rollback, focused temporary-chat shortcut routing (including Settings/visibility/focus guards and ChatGPT-native pass-through), retained Provider-view reuse, sender/origin checks, HTTPS-only external links and Provider navigation, and window geometry transitions/clamping.

## Manual checks by platform

Use a clean app data directory per OS, then record OS version, Electron version, Provider, date and result. Do not enter credentials in automated tests. For shell appearance checks, verify light and dark system modes without restarting the app.

1. Start Just Chat; confirm the window header has no app-name label and verify composer/settings in light and dark system appearances without restarting.
2. Start Just Chat; verify the compact Just Chat composer appears instead of the ChatGPT page.
3. Sign in normally. Quit and relaunch; verify login persists.
4. Start a conversation, resize/expand/collapse, and verify the page did not reload and the conversation remains present. Record any scroll/focus changes.
5. Type a harmless prompt in the Just Chat composer and send it. Confirm a fresh ChatGPT conversation opens and receives the text. If transfer fails, confirm the draft remains and the manual-open action copies it for pasting.
6. Test Provider file upload with a harmless local file and confirm the native chooser opens. Record supported file types and result.
7. Click an HTTPS external link; confirm it opens in the system browser. Try a non-HTTPS popup/navigation and confirm it is blocked.
8. Confirm camera, microphone and geolocation permission requests are denied.
9. Toggle the global shortcut while another app has focus; test hide/show, focus, and conflicts.
10. While Just Chat is focused in a signed-in ChatGPT session, press `Command+Shift+N` and confirm ChatGPT enters Temporary mode. Confirm the same shortcut in another app does not activate Just Chat or get intercepted. Confirm that a temporary conversation does not appear in chat history after leaving it.
11. In Settings, choose ChatGPT sign-out and cancel confirmation; verify the current session is still signed in. Confirm the action, verify the ChatGPT login page appears, settings and downloaded files remain, and no ChatGPT cookies remain in the Just Chat partition. Sign in normally again and verify persistence after restarting Just Chat.
12. Start a regular conversation, hide Just Chat, wait through the configured 30-minute timer, and confirm ChatGPT returns to a fresh page. Press `Command+K`, find the previous conversation and confirm it can be continued. Repeat with reset disabled to confirm the active page is retained.
13. Check the 900×220 Pop Over, Expanded and Full Screen modes on each display. Verify the same in-progress conversation remains loaded through each transition.
14. Move the popover to another display, quit, relaunch and check position restoration. Repeat with mixed scaling on Windows and Retina on macOS.
15. Measure idle and per-Provider resident memory with system tools after a fixed warm-up period; compare with one and two initialized Providers.

## Current evidence

- TypeScript checks: passed.
- Latest Orca validation: Vitest 9 files, 33 tests passed, including website-data clearing order/failure propagation and the focused temporary-chat shortcut routing tests.
- Production build: passed.
- Orca GUI: shell label removal plus composer and Settings captured in light and dark mode; changing system appearance updated the app without a restart. Screenshots are stored locally under `.omx/artifacts/ui-theme-verification/`.
- Composer design decision: retain a neutral shell-native draft surface, share shell theme/spacing/status language, and avoid copying or forcing the remote ChatGPT appearance. Code clears the local draft on successful handoff and preserves it with manual recovery feedback on failure. Actual signed-in transition comparison remains pending because the profile is logged out.
- ChatGPT sign-out: an earlier Orca run observed the confirmation cancel behavior, successful clear message, and sign-in screen. Re-login and download preservation were not checked. The current profile is logged out, so signed-in ChatGPT screen and composer handoff checks are pending.
- ChatGPT load retry: Orca reproduced a 30-second timeout/error UI on three cold launches. Each Retry immediately returned to the composer, then timed out again. No successful ChatGPT page load was observed. An unauthenticated HTTP check returned Cloudflare challenge 403; this does not distinguish an app defect from the logged-out/automation environment. Retry and authenticated handoff checks remain pending until a normal UI sign-in.
- Temporary-chat shortcut routing: automated tests cover macOS and Windows chord mapping, hidden/unfocused/settings-open rejection, custom-chord translation, and pass-through of ChatGPT's native chord from its WebView. The new provider-WebContents listener has not been exercised in a restarted Orca app because the open shell contains an unsent draft; live WebView and remote response remain unverified.
- Opt-in short performance sample (`pnpm dev:perf`): shell-ready 487.7 ms; unauthenticated ChatGPT page load 531.2 ms; sampled aggregate process working set was about 650 MiB. This is a brief development observation, not a release benchmark or idle-memory claim. See [PERFORMANCE.md](PERFORMANCE.md).
- Re-login after clearing, download preservation, file upload, shortcut behavior, cross-platform window behavior and sustained memory remain unverified. The user previously confirmed that ChatGPT login survived a `pnpm dev` restart; the dedicated clear-then-login-again flow in step 10 has not been manually exercised.
