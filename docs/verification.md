# Verification checklist

## Automated checks

Run after UI or runtime changes:

```sh
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Coverage includes settings normalization and persistence, shortcut registration and conflicts, focused shortcut routing, retained Provider-view reuse, sender/origin checks, navigation policy, and window geometry transitions.

## Manual checklist

Keep user credentials and account state under the user's control. Use a temporary app-data directory for unauthenticated smoke checks and never clear or alter the normal profile during verification.

- [ ] Launch opens directly into the retained ChatGPT web interface; no Just Chat composer screen appears.
- [x] ChatGPT opens in Quick Chat at 760×320; its message composer, attachment and send controls remain visible at a manually resized 280px minimum. The Pop Over remains 900×600.
- [ ] Settings opens, scrolls, and uses the available width in Pop Over, Expanded, and Full Screen modes.
- [ ] Shell controls remain limited to window mode, Settings, and Hide; their labels and accessibility names are clear.
- [ ] System light and dark appearances update the shell without restarting; the remote ChatGPT page retains its own theme.
- [x] Quick Chat ↔ Expanded transitions preserve the visible ChatGPT page; live authenticated conversation state was not tested.
- [ ] Pop Over and Full Screen transitions preserve the same WebContentsView and conversation state.
- [ ] Global Option+Space on macOS and Ctrl+Shift+Space on Windows show/hide Just Chat; other configured shortcuts do not register globally.
- [ ] Configured conversation-search shortcut works only while Just Chat is visible, focused, and in Pop Over; other applications receive their own shortcuts. Temporary chat remains available through ChatGPT's own UI; Just Chat does not provide an unverified shortcut for it.
- [ ] Settings changes persist after restart; sign-out confirmation cancel leaves the session untouched.
- [x] Window opacity control updates the native window; checked 80% and restored 100% in the isolated profile. ChatGPT content remains legible in the captured view.
- [x] Fresh-profile size check showed ChatGPT's sidebar and composer in the 1000×700 default Expanded window.
- [x] The ChatGPT sidebar collapses to its icon rail when its native close control is pressed; it reopens on app relaunch in the isolated profile. ChatGPT owns this page state, and persistent automatic collapse remains unimplemented.
- [ ] With a normal user-controlled sign-in, login persists after restart; ChatGPT conversations, voice, uploads, and native links behave correctly.
- [ ] A provider load failure shows Retry and can recover without exposing a blank shell.
- [ ] Window position and size restore across displays and restarts; test Retina and mixed-DPI displays on both operating systems.
- [ ] Test app behavior on Windows, including install, first launch, focus restoration, hotkeys, and all window modes.

## Current manual run — 2026-11-04

Run context: local macOS development build, isolated `--user-data-dir=/tmp/just-chat-manual-verify-20261104`, ChatGPT signed out. Orca initially had Accessibility and screenshot access; later its accessibility reader stopped exposing the Electron window although the permission status remained granted.

- [x] App opens directly into the ChatGPT WebContentsView; the custom Just Chat composer and handoff are removed.
- [x] The logged-out ChatGPT page displayed its own sidebar, login controls, and native message composer.
- [x] Startup opened in the reduced 1000×700 Expanded mode; the shell header contains only window mode, Settings, and Hide controls.
- [x] Pop Over now reached 900×600; ChatGPT's sidebar and message input remained visible. A prior 900×480 capture still clipped part of the sidebar, which motivated the 600 px minimum.
- [x] Settings opened in Expanded mode and used the available width; at Pop Over size a scrollbar was visible for the full Settings content.
- [x] Dark shell appearance was captured. Light appearance was not tested in this run; changing the system appearance was avoided.
- [x] ChatGPT load failure displayed an in-shell Retry message after the logged-out page timed out.
- [ ] Recheck Expand/Full Screen/return transitions on the latest build. A previous build returned with an unexpected small window after Full Screen; the latest Orca access failure prevented another reliable capture.
- [ ] Verify settings scrolling and persistence by changing a preference; Orca's semantic write to the native select did not take effect, and no alternative input was attempted.
- [ ] Verify Option+Space against the real macOS global event system; Orca's synthetic hotkey was unverified and did not show the hidden window.
- [ ] Login, message submission, history search, ChatGPT's temporary-chat UI, microphone/upload dialogs, and authenticated conversation continuity were not tested because this profile is signed out.
- [ ] Windows install/runtime and visual checks were not available on this host.

## Quick Chat run — 2026-11-04

Run context: local macOS development build, isolated `--user-data-dir=/tmp/just-chat-quickchat-launch-20261104`, ChatGPT signed out. The page rendered its logged-out home view before the provider timeout; no message was submitted.

- [x] Fresh launch opened ChatGPT directly in Quick Chat at 760×320 with the ChatGPT sidebar collapsed to its native icon button.
- [x] Orca capture at 760×320 showed the full message composer, attachment control, and send control. The ChatGPT footer overlapped the suggestion chip at this height.
- [x] Manual resize to the 280px minimum reached 284px in the native window capture and kept the composer, attachment and send controls visible; footer and suggestion content overlap more, so 280px is only the mechanical minimum, not the recommended default.
- [x] Expand control resized the same window to 1000×700; switching back restored the saved 760×284 test size. The remote page did not reload during the resize.
- Captures: [Quick Chat at 760×320](artifacts/quick-chat/quick-chat-760x320.png), [minimum height at 284px](artifacts/quick-chat/quick-chat-min-284.png).
- [x] Provider load timeout showed the existing Retry message. Login and message submission were not tested.
- [x] Electron signal feasibility checked against its `before-input-event` and `before-mouse-event` contracts: keyboard events expose key/modifiers/IME composition but not focused page control or input value; mouse events expose coordinates but not semantic target. Automatic grow-after-send was therefore not implemented; the visible Expand control remains the safe transition.
- [x] `pnpm exec vitest run src/shared/window-layout.test.ts` passed (9 tests); `pnpm typecheck` and `pnpm build` passed.

## Transparency note

Window opacity is adjustable from 60% to 100% in Settings and defaults to 100%. It applies to the ChatGPT page and shell together. The macOS run confirmed 80% and restored 100%; translucency against other desktop windows was not separately assessed. This is separate from making only the shell background translucent.
