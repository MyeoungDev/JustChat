# Implementation status audit

Audit date: 2026-11-02

“Verified” means covered by a passing automated test/build or directly observed in the local macOS smoke run. It does not imply Provider login or Windows compatibility.

## Project and dependencies

| Area | Status | Evidence / gap |
|---|---|---|
| Electron + TypeScript + React + Vite + pnpm | Implemented and verified | Type check and production build pass; local Electron process starts |
| Test runner | Implemented and verified | Vitest: 7 files, 20 tests pass |
| macOS/Windows packaging | Not implemented | No installer, signing, notarization or release artifacts |

## Runtime and UI

| Area | Status | Evidence / gap |
|---|---|---|
| Main process and settings persistence | Implemented and verified | SettingsStore saves atomically; file persistence has unit coverage; Electron callbacks still live in `src/main/index.ts` |
| Renderer | Implemented but unverified | Minimal shell composer, prompt transfer fallback, settings and shortcut capture compile; GUI interaction was not exercised |
| WebView implementation | Implemented but unverified | `WebContentsView` uses sandbox/security settings and is hidden behind the initial composer; live login and prompt transfer were not tested |
| Provider Adapter | Partially implemented | ChatGPT/Claude descriptors are wired and marked Experimental; Gemini/Grok are unavailable |
| Session persistence and isolation | Implemented; ChatGPT persistence manually observed | User confirmed ChatGPT login remained after stopping and restarting `pnpm dev`; separate provider partition policy is unit-tested, while isolation has not been manually tested. |
| Provider WebView reuse | Implemented and verified at registry level | Retained registry unit test proves a view factory is called once per Provider; live Electron identity/state continuity is not yet tested |
| Provider load failures | Implemented but unverified | Provider page remains visible while loading; timeout/error shows a retry banner; live network outcome remains unverified |

## Window and keyboard

| Area | Status | Evidence / gap |
|---|---|---|
| Pop Over / Expanded / Full Screen modes | Implemented but unverified | One BrowserWindow and retained active view; Pop Over defaults to 900×220, Expanded to 1200×800, and Full Screen targets current display bounds; native interaction not tested |
| Geometry persistence | Implemented and verified at helper/store level | x/y/width/height persist by mode; tests cover negative-coordinate monitor clamping and saved expanded size |
| Multiple monitors | Implemented but unverified | Mode changes now discard saved geometry from another display; helper behavior is unit-tested, physical multi-display run remains pending |
| Always on Top | Implemented but unverified | User setting is persisted and applied to both modes; native effect not manually checked |
| Auto-hide / Escape | Implemented but unverified | Auto-hide configurable, default off; Escape configurable, default on; native focus and Provider Escape conflicts need manual checks |
| Global ChatGPT shortcuts | Implemented but unverified | macOS/Windows defaults include temporary chat and ChatGPT history search forwarding, capture and conflict rollback; OS registration/conflicts and ChatGPT response are not manually exercised |
| Hidden-window conversation reset | Implemented but unverified | Defaults to reloading ChatGPT after 30 minutes hidden; configurable to 15/30/60 minutes or never; requires signed-in manual verification |
| Previously active app focus | Implemented but unverified | Uses native hide/show behavior and WebContents focus request; OS focus restoration needs manual verification |
| Provider chat input focus | Partially implemented | Focuses the WebContents; does not force focus into a site DOM input and makes no reliability claim |

## Security

| Area | Status | Evidence / gap |
|---|---|---|
| Node integration / context isolation / sandbox / webSecurity | Implemented but unverified | Explicit preferences on shell and Provider views; no runtime Electron preference inspection |
| IPC allowlisting and sender validation | Implemented and verified at helper level | All shell IPC checks sender ID, main frame and local origin; helper tests reject wrong sender/frame/origin |
| Provider origin validation | Implemented and verified at helper level | HTTPS allowlist and malformed/insecure URL cases tested; live login redirects unknown |
| External navigation | Implemented and verified at helper level | Only HTTPS opens externally; non-HTTPS schemes rejected in tests; real click behavior not checked |
| Permissions | Implemented but unverified | Provider sessions deny permission checks/requests; interactive provider effect not tested |
| Credential logging / remote native bridge | Implemented but unverified | Raw URL/error logs removed; remote views have no preload; release/package audit remains |

## Tests and measured behavior

| Area | Status | Evidence / gap |
|---|---|---|
| Window transitions / geometry | Implemented and verified | Simulated transition tests cover saved expanded geometry and clamping |
| Shortcut registration | Implemented and verified at helper level | Fake backend tests registration conflicts and rollback |
| Provider switching | Partially implemented | Unsupported IDs rejected; selection/reuse helpers tested; actual two-page conversation continuity untested |
| Settings persistence | Implemented and verified | Temp-file round-trip/default fallback tests pass on the local macOS host |
| WebView lifecycle | Implemented and verified at registry level | Generic retained-view test passes; no local mock Electron WebContents integration test |
| Performance | Partially implemented | Short macOS dev smoke measured 488 ms shell ready, 531 ms unauthenticated ChatGPT page load and ~650 MiB process working set; no warm transitions, logged-in profile, Windows or sustained idle run |
| Manual authentication / upload | Blocked | Requires a user-controlled account and interactive provider/OS dialogs |
