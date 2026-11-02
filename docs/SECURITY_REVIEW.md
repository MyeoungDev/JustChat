# Security review — Alpha

Date: 2026-11-02

## Scope and result

This is a source review of the Electron shell and remote-content boundary, not a penetration test. Electron 45.2.1, Chromium, dependencies and real Provider login flows must be re-reviewed before release.

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

## Remaining findings and release risks

1. **Provider host allowlists are hypotheses.** Test every supported login redirect. Add narrowly scoped HTTPS host entries only after observing a legitimate flow.
2. **External HTTPS opening is broad.** Allowlisted Provider/auth popups open in a secure child window using the Provider's persistent session; other HTTPS popups are sent to the system browser. Review phishing and redirect behavior before release.
3. **Session data is persistent.** Provider cookies and local storage remain in app data. Add and document logout/data deletion controls before public release.
4. **Shortcut conflicts need OS validation.** Conflicts are surfaced in settings and a failed custom replacement retains the prior bindings, but macOS/Windows conflict behavior has not been manually exercised.

## Release checks not yet completed

- Verify Electron fuses, signing, update provenance, dependency audit and packaged ASAR contents.
- Review provider terms and embedded browser/login policies.
- Test popup, redirect, permissions and file upload behavior on macOS and Windows.
- Confirm there is no remote-content preload and no Node integration in every WebContentsView after refactors.
- Validate settings file permissions/atomic updates on Windows as well as POSIX.
- Perform threat modeling for malicious provider content, compromised dependencies, phishing links and shared OS profile access.
