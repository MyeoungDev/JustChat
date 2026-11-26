# Floa Design

## Source of truth
- Status: Active for MVP
- Last refreshed: 2026-11-26
- Primary product surfaces: floating browser window, expanded and screen-filling window states, saved position presets, opacity and Clean Mode, click-through, tab strip, address/search controls, folder-grouped favorites start page, browsing history, settings, downloads, local video player, floating Notes workspace, Book Reader, Window Mirror, detached site windows
- Evidence reviewed: `README.md`, browser/settings/utility HTML, JS and CSS, the captured Glaso tour frames and interaction matrix in `../docs/artifacts/glaso/`, and REA findings in `../docs/menubarx-rea.md`
- Design-system reference: Glaso guided product animation captures in `../docs/artifacts/glaso/tour-frame-01.png` through `tour-frame-05.png` and its observed interaction/shortcut matrix in `../docs/artifacts/glaso/analysis.md`. Chrome's neutral white/gray light surfaces, charcoal dark surfaces, and blue focus/action colors guide the app palette.
- Adoption: preserve the compact tabbed browser hierarchy and floating utility behavior while using Chrome-inspired neutral surfaces and blue accents. Retain semantic tokens, keyboard access, system fonts, and native window behavior. Do not reproduce Glaso's website, logos, text, or artwork, and do not add a component dependency.

## Brand
- Personality: Quiet, quick, practical, and at home in the operating system.
- Trust signals: A clear address field, local and persistent website profile, visible browser controls, and understandable permission/download states.
- Avoid: MenubarX branding or artwork, a dashboard-heavy start page, decorative gradients that compete with website content, and ambiguous security prompts.

## Product goals
- Goals: Keep frequently used websites in a floating browser separate from the main browser, preserve website sessions, and support validated app deep links.
- Non-goals: Replace a full browser, synchronize data, sell subscriptions, or provide an extension ecosystem in the MVP.
- Success signals: Quick open/close, predictable navigation and focus, favorites and tabs restored after restart, and clear state in compact windows.

## Personas and jobs
- Primary personas: macOS and Windows users who need quick access to a few web apps while working elsewhere.
- User jobs: Open a saved site, search the web, keep a session available, move among a few sites, inspect or resume downloads, and play a local video without the display sleeping.
- Key contexts of use: Floating always-on-top app window on macOS and Windows; optional visibility across Spaces; detached site and download windows.

## Information architecture
- Primary navigation: Browser tabs and the separate Book Reader document library.
- Core routes/screens: Start page, embedded website, in-window Settings, History and Downloads windows, Notes workspace, Book Reader, Window Mirror, local video player, detached tab, and dedicated website app window.
- Content hierarchy: Active website first; tabs and browser controls above it; favorites only on the start page. Settings use grouped sections; download items are ordered by recency.

## Design principles
- Direct access: Opening the app returns focus to the current site or address field. Settings stay attached to the active browser context and Escape returns to that browser screen.
- Native fit: Use compact controls, system appearance, system fonts, and platform window conventions.
- Safe browsing: Restrict top-level browsing to HTTPS, with local HTTP allowed only for loopback development; describe permission and download decisions at the point of use.
- Consistent meaning: Components use semantic surface, text, border, accent, warning, and error tokens rather than local color guesses.
- Tradeoffs: Preserve the compact browser shell and sessions while applying cross-platform visual consistency; keep the web page itself visually untouched.

## Visual language
- Color: Chrome-inspired light mode uses a white browser toolbar, a cool gray tab strip, Google blue actions, and subtle blue selection. Dark mode uses a charcoal toolbar and tab strip, a slightly lifted charcoal active tab, and soft blue accents. Utility windows share the neutral surface tokens. Status colors always appear with text or an icon; website pixels remain outside the app theme. `design-tokens.css` owns the browser chrome and tab-strip surfaces separately so their hierarchy stays consistent in both themes.
- Typography: System UI stack (`-apple-system`, Segoe UI Variable, Segoe UI). Compact shell uses 13 px body text with 20 px line rhythm; secondary copy uses 11–12 px; section and page titles use semantic title roles. Use sentence case.
- Spacing/layout rhythm: 4 px base grid with 4/8/12/16/20/24/32 px tokens. The 82 px browser toolbar uses a navigation row and a text-labeled action row; the tab strip is 35 px. Keep page controls visually grouped and the floating web content dominant.
- Shape/radius/elevation: 4 px small, 7 px control, 9 px card, 13 px dialog radii. Use soft low-contrast separators, subtly tinted active tabs, and restrained elevation for transient dialogs/popovers.
- Motion: Short state transitions only; honor `prefers-reduced-motion`.
- Imagery/iconography: Simple symbols and user-provided/generated letter tiles; no copied product artwork. Keep labels and tooltips for icon-only controls.

## Components
- Existing components to reuse: Shared semantic CSS variables from `design-tokens.css`; native HTML buttons, inputs, selects, dialog, and form controls.
- New/changed components: Browser toolbar with expand and screen-fill actions, tab strip, address/search field, folder-grouped favorites tiles/editor, grouped settings rows, shortcut recorder, permission entries, download progress rows.
- Variants and states: Rest/hover/pressed/selected/disabled/focus-visible; empty and populated favorites/downloads; active/detached/discarded tabs; success/error/warning notices; light/dark/forced-color themes.
- Token/component ownership: `design-tokens.css` owns color, spacing, type, radius, stroke, shadow, and focus tokens. `style.css`, `settings.css`, `downloads.css`, and the Notes/Reader/Mirror/media styles own surface-specific layout and component styles.

## Accessibility
- Target standard: WCAG 2.2 AA as the implementation target; verify contrast for actual rendered combinations before release.
- Keyboard/focus behavior: Shortcuts are configurable in Settings; Option+G toggles the floating window, Option+Command+F toggles Spaces follow, Option+Command+C toggles Clean Mode, and Option+Command+P toggles click-through. Command+Y opens local browsing History; Command+F opens in-page search. Enter and the previous/next controls move through matches, while Escape closes search and returns focus to the page. Option+Command+Comma/Period adjusts opacity. Option+Command+1–5 restores saved window positions, Option+Shift+Command+1–5 saves them, Option+Command+Arrow moves the window, and Option+Command+0 resets its layout. Escape exits Clean Mode or screen-fill mode, or returns from Settings to the previous browser screen. Expand/restore and fill/restore actions also appear in the browser toolbar and menu. Toolbar actions keep visible text labels, show configured shortcuts on hover or keyboard focus, and expose their current state through accessible pressed values. Dialog close must return focus to the invoking control.
- Contrast/readability: Use high-contrast text/surface pairs and a persistent 2 px focus outline; do not use color alone for status. Allow zoom and system text rendering.
- Screen-reader semantics: Use named navigation, labeled inputs and actions, heading order, and live regions for download, notice, and permission updates.
- Reduced motion and sensory considerations: Suppress nonessential transitions under `prefers-reduced-motion`; avoid flashing, sound, and color-only feedback.

## Book Reader
- Reader is a floating, always-on-top document workspace opened with Option+Command+R. The local library supports PDF, EPUB, TXT, Markdown, RTF, and sanitized HTML imports.
- PDF pages render on demand to reduce memory pressure. EPUB and PDF text search, plus text-based search for text documents, are available from the toolbar. Bookmarks and EPUB/text highlights are local to the profile.
- Reader-scoped shortcuts are configurable in Settings and only run while the Reader window is focused. Escape from the search field returns focus to the reading surface.
- Do not claim upload, synchronization, OCR, DRM support, or PDF selection highlighting without implementing and verifying those behaviors.

## Window Mirror
- Mirror opens as a dedicated floating utility with a tab per selected app window. The user must choose each source before capture begins; audio is never requested.
- Show a persistent LIVE indicator while any source is captured, including while the source picker is open. Provide per-tab stop, stop-all, and close-window actions; closing the window stops every capture track. Do not save or transmit captured frames.
- On macOS, explain why Screen Recording permission is needed and open the system privacy pane when access is denied. Keep display capture permission isolated to the trusted Mirror window; websites remain blocked.
- Permission checks and permission requests must enforce the same policy: only the Mirror WebContents, after source authorization, may request video capture, and any request that includes audio must be denied.
- Preview remains read-only by default. On macOS, Interact is an explicit per-source opt-in that forwards pointer, drag, right-click, scroll, and supported key events to the selected window. Open Original raises only that selected window. Both actions require Accessibility trust; explain the permission and provide the system privacy pane link.
- Native input forwarding must resolve and revalidate the selected CGWindowID, owner PID, and bounds. Main-process IPC must check the mirror WebContents, source authorization, and per-source Interact state; revoking or closing a source must also disable forwarding. Never expose this bridge to website WebContentsViews.
- Validate live event delivery, display-coordinate mapping, target resizing, and held-button cleanup with a disposable window before treating Interact as runtime-verified. Windows builds keep preview-only behavior until an equivalent native backend exists.
- Mirror-scoped shortcuts are configurable in Settings and only run while Mirror is focused: add a source, stop the active tab, and cycle tabs. Keep source names in text nodes and never expose screen-capture permission to website WebContentsViews.

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
