# Privacy and local data

Just Chat is a desktop shell for the ChatGPT website. ChatGPT account data and conversations are handled by the service through its website. Just Chat does not provide a separate cloud account or app-managed conversation archive.

## Data stored on this device

- **Provider website data:** ChatGPT runs in a persistent Electron session that stores the website's cookies, local storage, cache, and other browser data so sign-in can persist. Claude uses a separate persistent session when that experimental provider is selected.
- **Just Chat settings:** Preferences and the last ChatGPT conversation path are stored in a JSON settings file under Electron's per-user application data directory. The saved path is limited to the conversation route; query parameters and conversation text are not saved in that setting.
- **Downloads:** Files downloaded through a provider page follow the operating system or Chromium download behavior; Just Chat does not manage a separate download archive.

## What the app sends or logs

The app loads provider pages directly. It does not intentionally send prompts, replies, cookies, or conversation titles to a Just Chat server. The ChatGPT completion observer reports only generation state to the local app so it can show a generic notification. The app currently has no product analytics or crash-reporting service configured.

Diagnostic messages may include provider identifiers, host names, error codes, or operating-system error details. Review and redact diagnostic output before posting it publicly.

## Clearing local data

Use **Settings → Sign out** to clear the ChatGPT session's cookies, website storage, cache, and HTTP authentication cache. This signs Just Chat out of ChatGPT but does not delete conversations from the ChatGPT account or remove downloaded files. Other app settings are stored separately and are not cleared by that control.

Uninstalling Just Chat does not intentionally remove its per-user application data. To remove all local Just Chat data, first use Settings to clear the ChatGPT session, quit the app, then remove its application data directory using the operating system's file manager. Be aware that doing so removes saved settings and may remove other local website state. Do not delete a profile while the app is running.

## Changes to this policy

This description reflects the current source and should be reviewed whenever telemetry, crash reporting, providers, storage, or release behavior changes. For security reports, see [SECURITY.md](SECURITY.md).
