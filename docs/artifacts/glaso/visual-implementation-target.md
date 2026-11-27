# Glaso visual and interaction reference for Just Browse

## Source and scope

- Public reference: [Glaso guided tour](https://glaso.app/es/tour/).
- Evidence: REA-controlled playback and captures documented in [`analysis.md`](analysis.md), with lesson frames [`tour-frame-01.png`](tour-frame-01.png) through [`tour-frame-05.png`](tour-frame-05.png).
- Scope: Glaso's demonstrated desktop app chrome and interactions. The surrounding marketing website, its branding, copy, and artwork are not implementation targets.
- Capture state: Public tour page at 1440×900, five animation lessons completed. The app UI appears inside the lesson recordings; capture size is therefore illustrative, not a pixel-accurate native-app baseline.
- No Glaso app, installer, binary, source code, or private material was used.

## Visual target

- Compact, floating macOS browser chrome with Chrome-like neutral light/dark surfaces, clear address and tab rows, and a legible separation between app controls and the active web page.
- Rounded, quiet controls and surfaces. Use Chrome blue for active state, primary actions, and keyboard focus.
- Keep the active page visually dominant. Notes and Reader replace the Browser content inside the shared Floa window; the local video player remains a focused separate window.
- Retain Just Browse names, icons, copy, and accessibility semantics. Do not import Glaso assets or reproduce the tour website's decorative background.

## Interaction target

- One configurable global shortcut reveals or hides the floating browser.
- Window controls support opacity, pin/follow behavior, clean mode, click-through, saved positions, and keyboard nudging where implemented.
- Browser tabs, address/search, navigation, favorites, local video, Notes, and Reader follow the public behavior and shortcut matrix in [`analysis.md`](analysis.md).
- Visible state, keyboard focus, and the action's result should remain clear. Escape returns from transient controls to the prior working surface.

## Just Browse baseline and implementation

- Prior app capture: [`just-browse-floating-window-2026-11-26.png`](just-browse-floating-window-2026-11-26.png).
- Current Chrome-palette dark-theme capture: [`just-browse-chrome-dark-2026-11-26.png`](just-browse-chrome-dark-2026-11-26.png), captured at 1100×760 through Orca Computer Use from an empty test profile.
- Reusable design tokens: [`design-tokens.css`](../../../menubarx-app/design-tokens.css).
- Browser surface: [`style.css`](../../../menubarx-app/style.css).
- Related floating utilities share the same semantic tokens; the local video player now uses them too.

## Verification boundary

- The reference is a guided product animation, not a capture of Glaso running on this Mac. It supports visual and interaction direction, not claims about internal implementation.
- Native macOS titlebar, window layering, and screen recording permission must be verified on the host OS. The CUA connector did not grant direct Electron access; Orca Computer Use did capture the window.
- This is a first-pass dark-theme comparison, not a pixel-level match score. Compare the application surfaces and states, not the tour website surrounding them.
