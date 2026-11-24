# Security review — Alpha

Date: 2026-11-16

## Scope and result

This is a source review of the Electron shell, packaging configuration, and remote-content boundary, not a penetration test. Electron 45.2.1, Chromium, dependencies and real Provider login flows must be re-reviewed before each stable release.

## Implemented controls

- Local shell and Provider WebContentsViews set `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`; remote views have no preload.
- ChatGPT and Claude use different persistent session partitions.
- Remote permissions are denied by default.
- Top-level navigation and redirects must use HTTPS and match Provider host allowlists.
- Allowlisted Provider/auth popups use a secure child window with the Provider's persistent partition; other HTTPS popup URLs are opened by the system browser.
- Local-shell IPC validates the sender WebContents, main frame, and development origin or local file scheme before acting.
- Preload exposes a narrow command surface rather than `ipcRenderer` itself. The local shell declares a restrictive CSP.
- Provider pages remain visible while loading so browser challenges and sign-in screens can render. Errors show a retry banner; raw URLs and error descriptions are not logged.
- External URL opening rejects non-HTTPS schemes.
- Packaged builds use ASAR and configure Electron fuses to disable RunAsNode, Node options, and inspector flags; enable embedded ASAR integrity validation and only load app code from ASAR; and disable extra `file://` privileges. Cookie encryption is left unset to avoid an irreversible profile-format change.
- The package includes compiled `out/` files and the runtime PNG only. Platform artwork is supplied to the packager; source files and source maps are excluded from the app payload.
- CI uses read-only repository permissions except for the final draft-release job, which receives `contents: write`. The release workflow waits for both platform jobs and creates a draft, not a published release.

## Remaining findings and release risks

1. **Provider host allowlists are hypotheses.** Test every supported login redirect. Add narrowly scoped HTTPS host entries only after observing a legitimate flow.
2. **External HTTPS opening is broad.** Allowlisted Provider/auth popups open in a secure child window using the Provider's persistent session; other HTTPS popups are sent to the system browser. Review phishing and redirect behavior before release.
3. **Session data is persistent until the user clears it.** Settings now offers a confirmed action that clears ChatGPT's isolated session data and reloads the provider. This does not delete account conversations or downloaded files. The ChatGPT logout/re-login flow still needs a manual test; Claude's separate partition has no user-facing clear control while that Provider remains in the experimental surface.
4. **Shortcut conflicts need OS validation.** Conflicts are surfaced in settings and a failed custom replacement retains the prior bindings, but macOS/Windows conflict behavior has not been manually exercised.

## Release checks not yet completed

- Verify configured Electron fuses and packaged ASAR contents in the first native CI build.
- Configure Apple Developer ID signing/notarization and Windows Authenticode only after credentials and a signing review are available. Set `JUST_CHAT_REQUIRE_SIGNING=1` so signed builds fail closed; never commit credentials.
- Enable GitHub private vulnerability reporting in repository Security settings; the source file cannot toggle this setting.
- Verify dependency audit, release artifact hashes, update provenance, GitHub Actions action pins and workflow logs before a stable release.
- Review provider terms and embedded browser/login policies.
- Test popup, redirect, permissions and file upload behavior on macOS and Windows.
- Confirm there is no remote-content preload and no Node integration in every WebContentsView after refactors.
- Validate settings file permissions/atomic updates on Windows as well as POSIX.
- Perform threat modeling for malicious provider content, compromised dependencies, phishing links and shared OS profile access.
