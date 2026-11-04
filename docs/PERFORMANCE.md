# Performance — Alpha baseline

Date: 2026-11-03

## Local development smoke measurement

Measured on macOS 27.0.1 (Apple M3 Pro, 36 GB RAM), Node 24.15.0 and Electron 45.2.1, in development mode. ChatGPT loaded without signing in. This is a single short smoke run, not a release benchmark.

| Metric | Result | How to measure |
|---|---|---|
| Cold startup to shell ready | 488 ms, one development launch | Main-process start to BrowserWindow `ready-to-show`; repeat 10 packaged cold launches |
| ChatGPT initial page load | 531 ms, unauthenticated | `loadURL` start to `did-finish-load`; network- and site-dependent |
| Warm Pop Over show/hide | Not exercised | Timestamp shortcut receipt to native `show`/`hide`; run 30 warm toggles |
| Expand/Collapse latency | Not exercised | Opt-in `window-popover-api-ms` / `window-expanded-api-ms` traces; run 30 transitions |
| Loaded Provider switch | Not exercised | Opt-in `provider-switch-warm-ms` / `provider-switch-to-ready-ms` traces; run 30 switches |
| Total Electron process working set | Approx. 649.6–651.1 MiB | Sum of `workingSetSize` across Browser, GPU, Utility and two Tab processes; 5 samples, 5 seconds apart |
| Idle CPU | 0.00–0.02% summed process samples in the short observation | `app.getAppMetrics()` samples every 5 seconds; about 25 seconds, not a sustained idle run |

The page load was unauthenticated; login and conversation rendering may change memory and timings. Development-mode results include a different runtime path than packaged builds.

## Development-mode repeated transitions (2026-11-03)

Measured on macOS 27.0.1 (Apple M3 Pro, 36 GB RAM), Node 24.15.0 and Electron 45.2.1, using an isolated `/tmp/just-chat-g006-toggle-profile` profile with ChatGPT signed out. The performance-only IPC invoked the same `toggleWindow()` path as the global shortcut and awaited each native Electron `show` or `hide` event before starting the next transition. There were 30 completed transitions of each type; initial and final shell mode were Pop Over, and no prompt was submitted.

| Transition | n | Median | Nearest-rank p95 | Range |
|---|---:|---:|---:|---:|
| Show | 30 | 22.2 ms | 80.9 ms | 17.6–90.0 ms |
| Hide | 30 | 280.6 ms | 290.1 ms | 273.9–290.7 ms |

These are development-mode native-window transition timings, not packaged-app timings. They include IPC and Electron event delivery and were measured on one Mac; Windows 11 and authenticated ChatGPT behavior remain unmeasured. The earlier rapid-toggle attempt was discarded because it did not await native transitions.

## Instrumentation and lifecycle policy

- Enable the terminal-only sampler with `pnpm dev:perf`. It reports cold shell startup, Provider page load, native open/hide event timings, mode resize API duration, Provider switch duration, and per-process CPU/working set. It writes no telemetry file and logs no URLs or conversation data.
- Preserve each instantiated Provider WebContentsView during Alpha. Do not destroy pages to improve benchmark numbers while they may own active responses or draft input.
- Measure cold page loading separately from warm view switching; network and Provider changes make load timings noisy.
- If memory becomes a problem, measure hidden-view cost first. Eviction requires a user-safe active-response/draft policy and restoration tests.

## Next measurement run

Capture the table separately on supported macOS and Windows 11 systems, including OS build, CPU, RAM, display scale, network, Electron version and Provider sign-in state. Repeat cold startup 10 times and idle CPU for 5 minutes. Do not compare different machines/providers as controlled tests.
