# Design

## Source of truth
- Status: Active for Alpha
- Last refreshed: 2026-11-05
- Primary product surfaces: ChatGPT-first Quick Chat, Expanded chat, Full Screen chat, responsive settings view
- Evidence reviewed: existing `README.md`, Electron architecture review, React shell and CSS in `src/renderer/ui/`, user feedback on direct ChatGPT entry, Pop Over size, Settings responsiveness, and system appearance

## Brand
- Personality: Quiet, direct, lightweight, dependable
- Trust signals: Provider-owned web UI, explicit experimental status, no local conversation archive by default
- Avoid: AI-workspace visuals, dashboards, agent metaphors, marketing gradients, unnecessary decoration

## Product goals
- Goals: Open directly into ChatGPT from one shortcut; preserve continuity while changing window size; keep the shell understandable at a glance
- Non-goals: Replace Provider interfaces, manage projects, automate conversations, or compare models in the default experience
- Success signals: Fast return to a loaded conversation; keyboard flows work without navigating a dashboard; supported and experimental Providers are clearly distinguished

## Personas and jobs
- Primary personas: People who already use web AI services and want quick access while working in another app
- User jobs: Ask a quick question, continue a longer conversation, switch between existing AI services
- Key contexts of use: Floating compact window over another application; larger window for focused conversation

## Information architecture
- Primary navigation: ChatGPT is the current Alpha focus
- Core routes/screens: ChatGPT web interface and an in-shell settings surface
- Content hierarchy: Provider conversation first; Just Chat controls second; settings only on explicit request. Avoid repeating the app name in the compact window header when its controls already identify the shell.

## Design principles
- Conversation first: Provider content owns the chat surface
- System fit: Shell surfaces and controls follow the operating system's light/dark appearance; avoid a bright shell around a dark conversation.
- Direct entry: Show the ChatGPT web interface as soon as the app opens; do not interpose a separate Just Chat composer.
- Keyboard first: Global shortcuts and visible shortcut guidance; focus should be predictable
- Minimal interface: Keep native controls to title, Provider, window mode and settings
- Seamless continuity: Resize/reparent existing web content without reloading
- Provider independence: Keep differences explicit; never imply unsupported Providers work
- Tradeoffs: Reliability and honest compatibility status take precedence over dense customization

## Visual language
- Color: Use semantic shell tokens for light and dark system appearances, with readable contrast. The Provider page may retain its own in-site appearance setting; do not imply the shell can force a remote page's theme unless supported.
- Typography: Native system sans-serif, compact but readable
- Spacing/layout rhythm: Tight title row and one Provider row; avoid extra navigation rail
- Shape/radius/elevation: Subtle rounded buttons, restrained separators, minimal shadow
- Motion: No required transition animation; OS window transitions take priority
- Imagery/iconography: Simple text labels and familiar small symbols; no decorative hero art

## Components
- Existing components to reuse: Shell header, Provider tabs, simple control buttons, light/dark semantic CSS tokens
- New/changed components: Settings groups, shortcut capture control, Provider connection state
- Variants and states: active, inactive, unavailable, experimental, loading, failed
- Token/component ownership: `src/renderer/ui/styles.css`; no additional design-system dependency

## Accessibility
- Target standard: Platform accessibility APIs and WCAG 2.2 AA for shell content where applicable
- Keyboard/focus behavior: All shell actions are buttons; shortcut capture has an explicit focused state; Escape behavior is configurable
- Contrast/readability: Keep secondary text legible against neutral surfaces
- Screen-reader semantics: Use button names, labeled navigation and status announcements
- Reduced motion and sensory considerations: Avoid flashing and nonessential motion

## Responsive behavior
- Supported breakpoints/devices: Desktop windows on macOS and Windows; 520×200 Quick Chat (480×180 minimum), 520×480 default Expanded window (480×400 minimum) and Full Screen on the current display
- Layout adaptations: Keep shell controls in a fixed-height header; keep the ChatGPT composer visible in Quick Chat; settings content expands with the available window width
- Touch/hover differences: Hover is optional feedback; buttons remain visible and keyboard reachable

## Interaction states
- Loading: Keep the remote page visible while it loads so provider sign-in and browser challenges remain accessible
- Empty: Not applicable; chat empty state belongs to the Provider
- Error: Show a plain retry action for navigation/load failures
- Success: Return control to the Provider web experience
- Disabled: Unimplemented Gemini and Grok choices remain visibly unavailable
- Offline/slow network, if applicable: Do not fake readiness; show loading or retry state

## ChatGPT-first experience
- Decision: Launch directly into the retained ChatGPT web interface. Keep Just Chat chrome limited to window mode, Settings and Hide controls.
- Window behavior: Open into Quick Chat at 520×200 (480×180 minimum), centered horizontally with its center at 82% of the active display work area's height; Expanded defaults to 520×480 (480×400 minimum). Quick Chat grows upward while preserving its width. Open newly shown windows on the mouse pointer's display and preserve geometry per display and mode. A single size control toggles Quick Chat and Expanded; a separate control fills the current display. Dismiss an empty Quick Chat on focus loss while keeping a routed ChatGPT conversation available. Quick Chat grows into Expanded on an unmodified Enter key or when ChatGPT navigates to a conversation, keeping the lower edge in place. Enter detection is a best-effort signal because Electron does not expose which page control received the key. The ChatGPT sidebar is collapsed again after window resizing when possible to keep the conversation centered in the compact window.
- Theme ownership: The Just Chat shell follows the system appearance. ChatGPT's remote page keeps its own appearance setting; do not force or imply synchronized remote theming.
- Window opacity: Settings offers a whole-window opacity slider from 60% to 100%, defaulting to 100%. The remote ChatGPT page, text, and shell controls all fade together, so 100% remains one drag away if reduced opacity hurts readability.
- Evidence: The renderer now shows the retained ChatGPT view immediately and Settings remains an in-shell surface. Signed-in conversation display and theme transition remain pending normal user-controlled sign-in.

## Content voice
- Tone: Plain, calm, concise
- Terminology: “Quick Chat”, “Pop Over”, “Expanded”, “Full Screen”, “ChatGPT”, “Experimental”
- Microcopy rules: Explain what is unavailable without marketing claims or blame

## Implementation constraints
- Framework/styling system: Electron, React, TypeScript, plain CSS
- Design-token constraints: Extend current neutrals into light/dark semantic CSS variables; derive the shell appearance from the OS preference; avoid introducing a component library
- Performance constraints: Keep Provider WebContentsView instances to preserve state; measure before eviction
- Compatibility constraints: Electron APIs may still differ in window management by OS; verify each platform
- Test/screenshot expectations: Test state logic and controls; capture OS-specific visuals during manual platform verification

## Open questions
- [ ] Confirm through Orca UI review that the unwanted app-name label is gone from the surface the user meant; current code removed the in-window `.brand` label. If the user meant an OS menu-bar item, inspect that platform-specific surface separately.
- [x] Composer direction: remove the separate shell composer and launch directly into ChatGPT; preserve the provider-owned input and conversation interface.
- [ ] Which macOS and Windows versions should be used to verify system light/dark switching and contrast?
- [ ] Should Auto-hide be enabled by default after multi-platform user testing?
- [ ] What is the preferred default macOS shortcut after checking conflicts on supported macOS versions?
- [ ] Which additional auth redirect hosts are actually required for supported Provider login flows?
