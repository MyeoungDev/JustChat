# Just Chat

Just Chat is a minimal, keyboard-first desktop shell for ChatGPT. The compact Pop Over starts with a Just Chat composer; sending opens a fresh ChatGPT web conversation and transfers the prompt into ChatGPT's own page. The app also provides Expanded and Full Screen modes, configurable shortcuts and preferences, and an optional idle reset.

## Requirements

- Node.js 22.12+ (Node 24 recommended)
- pnpm 10+
- macOS or Windows desktop environment

## Run locally

```sh
pnpm install
pnpm dev
```

Default shortcuts are **Option+Space** on macOS and **Ctrl+Shift+Space** on Windows to show or hide Just Chat. **Command+Shift+N** on macOS ( **Ctrl+Shift+N** on Windows) opens ChatGPT's Temporary mode. **Command+K** on macOS ( **Ctrl+K** on Windows) opens ChatGPT's conversation search. Open Settings with the gear to customize shortcuts and choose whether to reload ChatGPT to a fresh page after the window stays hidden for 15, 30 or 60 minutes. This timer defaults to 30 minutes and can be disabled. It starts when Just Chat is hidden; showing the window again cancels it. The app does not save or index chat content locally. Prompt transfer relies on ChatGPT's current web composer controls. If it fails, the draft remains in Just Chat and the user can open ChatGPT with the draft copied to the clipboard for manual paste.

```sh
pnpm typecheck
pnpm test
pnpm build
```

For opt-in timing and process samples:

```sh
pnpm dev:perf
```

The performance sampler prints to the terminal and does not save URLs, prompts or telemetry files.

## Structure

```text
src/
  main/       Electron main process and settings persistence
  preload/    narrow IPC bridge for the trusted local shell
  renderer/   local React shell, Provider controls and settings
  shared/     settings, shortcuts, Provider policy, geometry and testable state helpers
docs/
  IMPLEMENTATION_STATUS.md
  PERFORMANCE.md
  SECURITY_REVIEW.md
  architecture-review.md
  verification.md
```

## Provider support and limits

- ChatGPT is the active development target and remains **Experimental** until interactive compatibility checks pass.
- Other providers are deferred; they are not part of the current user-facing workflow.
- Gemini and Grok are not implemented in this Alpha and remain visibly unavailable.
- Provider top-level navigation is limited to the HTTPS host allowlist in `src/shared/providers.ts`; real authentication redirects need verification.
- Separate persistent browser partitions are configured. The user confirmed ChatGPT login persisted after restarting `pnpm dev`; isolation for other Providers is deferred and unverified.
- Chat input focus is requested at the WebContents level; the app does not use fragile DOM automation to force focus into a Provider input.
- Chat contents are not extracted or saved locally. No provider API or conversation automation is implemented.
- Native menu/tray, installer/signing, detailed download handling, packaged Windows testing and cross-platform focus verification remain future work.

See [Implementation Status](docs/IMPLEMENTATION_STATUS.md), [Architecture Review](docs/architecture-review.md), [Security Review](docs/SECURITY_REVIEW.md), [Performance](docs/PERFORMANCE.md), and [Verification Plan](docs/verification.md).
