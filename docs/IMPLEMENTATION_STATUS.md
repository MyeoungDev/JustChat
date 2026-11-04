# Implementation status audit

Audit date: 2026-11-04

“Verified” means covered by a passing automated test/build or directly observed in the local macOS smoke run. It does not imply Provider login or Windows compatibility.

## Project and dependencies

| Area | Status | Evidence / gap |
|---|---|---|
| Electron + TypeScript + React + Vite + pnpm | Implemented and verified | Type check and production build pass; local Electron process starts |
| Test runner | Implemented and verified | Vitest: 8 files, 25 tests pass |
| macOS/Windows packaging | Not implemented | No installer, signing, notarization or release artifacts |

## Runtime and UI

| Area | Status | Evidence / gap |
|---|---|---|
| Main process and settings persistence | Implemented and verified | SettingsStore saves atomically; file persistence has unit coverage; Electron callbacks still live in `src/main/index.ts` |
| Renderer | ChatGPT-first UI implemented; current change requires manual recheck | Removed the separate Just Chat composer and handoff path; startup now opens the retained ChatGPT WebContentsView directly. The in-shell controls are window mode, Settings and Hide. Current manual verification uses an isolated logged-out macOS profile; authenticated flows remain unverified. |
| System appearance | Implemented and visually verified on macOS | `prefers-color-scheme` semantic tokens and Electron `nativeTheme` window background match both system appearances; muted hint text measures 4.58:1 in light shell and 6.20:1 in dark surface. See local Orca captures under `.omx/artifacts/ui-theme-verification/` |
| WebView implementation | Implemented; live account flow unverified | `WebContentsView` uses sandbox/security settings and is visible on startup. The logged-out ChatGPT landing page was observed; login and authenticated conversation behavior remain unverified. |
| Provider Adapter | Partially implemented | ChatGPT/Claude descriptors are wired and marked Experimental; Gemini/Grok are unavailable |
| Session persistence and isolation | Implemented; ChatGPT persistence manually observed | User confirmed ChatGPT login remained after stopping and restarting `pnpm dev`; separate provider partition policy is unit-tested, while isolation has not been manually tested. |
| ChatGPT sign-out and local data clearing | Implemented; helper tests pass and sign-out result was observed | Settings requires confirmation, clears the ChatGPT partition's cookies/site storage/cache and HTTP auth cache, then reloads ChatGPT. The prior Orca run observed the success message and sign-in screen; it did not inspect storage/download preservation or sign in again. |
| Provider WebView reuse | Implemented and verified at registry level | Retained registry unit test proves a view factory is called once per Provider; live Electron identity/state continuity is not yet tested |
| Provider load failures | Error and retry UI observed; successful load blocked by current environment | Orca reproduced a 30-second timeout and retry banner on 3 cold launches; all 3 retries returned to the same error. Current ChatGPT profile is logged out, and unauthenticated `curl -I https://chatgpt.com` returned Cloudflare challenge HTTP 403. Recheck after normal UI sign-in before diagnosing as a product defect. |

## Window and keyboard

| Area | Status | Evidence / gap |
|---|---|---|
| Quick Chat / Pop Over / Expanded / Full Screen modes | Quick Chat startup added; automatic grow-after-send deferred | One BrowserWindow and retained active view; Quick Chat targets 760×320 with a 640×280 minimum, Pop Over targets 900×600 with a 700×600 minimum, Expanded defaults to 1000×700, and Full Screen fills the current display. User-saved sizes are preserved by mode. The existing Expand control grows the same view; no reliable provider-independent send signal is available without reading ChatGPT page UI. |
| Geometry persistence | Implemented and verified at helper/store level | x/y/width/height persist by mode; tests cover negative-coordinate monitor clamping and saved expanded size |
| Multiple monitors | Implemented but unverified | Mode changes now discard saved geometry from another display; helper behavior is unit-tested, physical multi-display run remains pending |
| Always on Top | Implemented but unverified | User setting is persisted and applied to both modes; native effect not manually checked |
| Auto-hide / Escape | Implemented but unverified | Auto-hide configurable, default off; Escape configurable, default on; native focus and Provider Escape conflicts need manual checks |
| Temporary-chat shortcut | Removed from Just Chat | ChatGPT's temporary-chat shortcut behavior is not verified, so Just Chat no longer advertises or sends a shortcut for it. Users can still choose temporary chat through ChatGPT's own UI. The configured conversation-search shortcut remains available while Just Chat is focused in Pop Over. |
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
