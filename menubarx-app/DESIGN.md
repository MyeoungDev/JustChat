# Just Browse Design

## Source of truth
- Status: Active for MVP
- Last refreshed: 2026-11-25
- Primary product surfaces: menu bar browser panel, standard browser window, tab strip, address/search controls, favorites start page, settings, downloads, detached site windows
- Evidence reviewed: `README.md`, `index.html`, `renderer.js`, `style.css`, `settings.html`, `settings.js`, `settings.css`, `downloads.html`, `downloads.js`, `downloads.css`, and REA findings in `../docs/menubarx-rea.md`
- Design-system reference: [Fluent 2 design tokens](https://fluent2.microsoft.design/design-tokens/), [color](https://fluent2.microsoft.design/color/), [typography](https://fluent2.microsoft.design/typography/), [layout](https://fluent2.microsoft.design/layout), and [accessibility](https://fluent2.microsoft.design/accessibility)
- Adoption: use Fluent 2's semantic token, theming, hierarchy, and accessibility approach. Keep the current lightweight HTML/CSS/JS implementation and use platform system fonts and native window behavior; do not add Fluent React components or copy a Fluent product shell.

## Brand
- Personality: Quiet, quick, practical, and at home in the operating system.
- Trust signals: A clear address field, local and persistent website profile, visible browser controls, and understandable permission/download states.
- Avoid: MenubarX branding or artwork, a dashboard-heavy start page, decorative gradients that compete with website content, and ambiguous security prompts.

## Product goals
- Goals: Open frequently used websites from the menu bar, keep browsing separate from the main browser, preserve website sessions, and support validated app deep links.
- Non-goals: Replace a full browser, synchronize data, sell subscriptions, or provide an extension ecosystem in the MVP.
- Success signals: Quick open/close, predictable navigation and focus, favorites and tabs restored after restart, and clear state in compact windows.

## Personas and jobs
- Primary personas: macOS and Windows users who need quick access to a few web apps while working elsewhere.
- User jobs: Open a saved site, search the web, keep a session available, move among a few sites, and inspect or resume downloads.
- Key contexts of use: Compact menu bar panel on macOS; standard app window on macOS or Windows; detached site and download windows.

## Information architecture
- Primary navigation: Browser tabs.
- Core routes/screens: Start page, embedded website, in-place Settings in panel mode, focused modal Settings in standard-window mode, Downloads window, detached tab, and dedicated website app window.
- Content hierarchy: Active website first; tabs and browser controls above it; favorites only on the start page. Settings use grouped sections; download items are ordered by recency.

## Design principles
- Direct access: Opening the app returns focus to the current site or address field. Settings stay attached to the active browser context and Escape returns to that browser screen.
- Native fit: Use compact controls, system appearance, system fonts, and platform window conventions.
- Safe browsing: Restrict top-level browsing to HTTPS, with local HTTP allowed only for loopback development; describe permission and download decisions at the point of use.
- Consistent meaning: Components use semantic surface, text, border, accent, warning, and error tokens rather than local color guesses.
- Tradeoffs: Preserve the compact browser shell and sessions while applying cross-platform visual consistency; keep the web page itself visually untouched.

## Visual language
- Color: Fluent 2-inspired semantic neutral layers and one restrained blue action color. Light/dark palettes are defined in `design-tokens.css`; website pixels remain outside the app theme. Status colors always appear with text or an icon.
- Typography: System UI stack (`-apple-system`, Segoe UI Variable, Segoe UI). Compact shell uses 13 px body text with 20 px line rhythm; secondary copy uses 11–12 px; section and page titles use semantic title roles. Use sentence case.
- Spacing/layout rhythm: 4 px base grid with 4/8/12/16/20/24/32 px tokens. Browser toolbar stays 48 px and tab strip 34 px to protect compact use.
- Shape/radius/elevation: 4 px small, 6 px control, 8 px card, 12 px dialog radii. Use a thin neutral separator for hierarchy and reserve elevation for transient dialogs/popovers.
- Motion: Short state transitions only; honor `prefers-reduced-motion`.
- Imagery/iconography: Simple symbols and user-provided/generated letter tiles; no copied product artwork. Keep labels and tooltips for icon-only controls.

## Components
- Existing components to reuse: Shared semantic CSS variables from `design-tokens.css`; native HTML buttons, inputs, selects, dialog, and form controls.
- New/changed components: Browser toolbar, tab strip, address/search field, favorites tiles/editor, grouped settings rows, shortcut recorder, permission entries, download progress rows.
- Variants and states: Rest/hover/pressed/selected/disabled/focus-visible; empty and populated favorites/downloads; active/detached/discarded tabs; success/error/warning notices; light/dark/forced-color themes.
- Token/component ownership: `design-tokens.css` owns color, spacing, type, radius, stroke, shadow, and focus tokens. `style.css`, `settings.css`, and `downloads.css` own surface-specific layout and component styles.

## Accessibility
- Target standard: WCAG 2.2 AA as the implementation target; verify contrast for actual rendered combinations before release.
- Keyboard/focus behavior: Shortcuts are configurable in Settings; Escape returns from Settings to the previous browser screen and hides the panel only while on the browser screen. Dialog close must return focus to the invoking control. All icon-only browser actions have accessible names.
- Contrast/readability: Use high-contrast text/surface pairs and a persistent 2 px focus outline; do not use color alone for status. Allow zoom and system text rendering.
- Screen-reader semantics: Use named navigation, labeled inputs and actions, heading order, and live regions for download, notice, and permission updates.
- Reduced motion and sensory considerations: Suppress nonessential transitions under `prefers-reduced-motion`; avoid flashing, sound, and color-only feedback.

## Responsive behavior
- Supported breakpoints/devices: Resizable desktop windows on macOS and Windows; viewport emulation applies only to the embedded website.
- Layout adaptations: Browser toolbar retains a flexible address field; favorites reflow to available width; settings rows stack at narrow widths; long filenames and download paths wrap or truncate without pushing actions offscreen.
- Touch/hover differences: Controls remain visible and keyboard reachable; hover adds feedback but never exposes the only path to an action.

## Interaction states
- Loading: Embedded page owns network loading UI; download progress uses a labeled progress track and byte/speed details.
- Empty: Favorites explain how to add a site; downloads show an explicit empty state.
- Error: Invalid/unsupported navigation and failed actions receive visible concise feedback; errors include text, not only color.
- Success: Navigate in the active tab and retain its session; completed downloads expose Show in Folder.
- Disabled: Back/forward and unavailable download actions are visibly disabled and not focus traps.
- Offline/slow network: Website browser failure remains visible; download progress and interrupted state stay distinguishable.

## Content voice
- Tone: Plain, calm, concise.
- Terminology: Tab, Favorites, Address or search, Keep window on top, Settings, Downloads.
- Microcopy rules: Use sentence case; explain unsupported actions and consequences in plain language; use consistent names across menus and settings.

## Implementation constraints
- Framework/styling system: Electron, CommonJS main/preload, vanilla HTML/CSS/JS renderer.
- Design-token constraints: No UI dependency for MVP; shared semantic tokens are plain CSS in `design-tokens.css`.
- Performance constraints: Keep views alive per open tab to preserve page state; avoid expensive blur effects and large animation workloads.
- Compatibility constraints: macOS and Windows desktop; Electron is provided by the repository root. Respect native dark mode and forced-colors where available.
- Test/screenshot expectations: Check panel and standard-window layouts, keyboard focus, settings return path, downloads empty/progress/completed states, and light/dark appearance on macOS and Windows before release.

## Open questions
- [ ] Capture and review macOS and Windows screenshots at the smallest supported window size; owner: project; impact: spacing and responsive adjustments.
- [ ] Measure actual text/control contrast in both themes with a rendered contrast audit; owner: project; impact: WCAG 2.2 AA release readiness.
- [ ] Decide whether to localize the English UI before a public release; owner: product; impact: content length and layout.
