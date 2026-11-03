# Design

## Source of truth
- Status: Active for Alpha
- Last refreshed: 2026-11-03
- Primary product surfaces: compact Pop Over chat, Expanded chat, Full Screen chat, compact settings view
- Evidence reviewed: PRD/TDD provided in the conversation, Phase 2 brief, existing `README.md`, Electron architecture review, React shell and CSS in `src/renderer/ui/`, user feedback on the app label, system appearance, and composer-to-ChatGPT transition

## Brand
- Personality: Quiet, direct, lightweight, dependable
- Trust signals: Provider-owned web UI, explicit experimental status, no local conversation archive by default
- Avoid: AI-workspace visuals, dashboards, agent metaphors, marketing gradients, unnecessary decoration

## Product goals
- Goals: Put the ChatGPT conversation one shortcut away; preserve continuity while changing window size; keep the shell understandable at a glance
- Non-goals: Replace Provider interfaces, manage projects, automate conversations, or compare models in the default experience
- Success signals: Fast return to a loaded conversation; keyboard flows work without navigating a dashboard; supported and experimental Providers are clearly distinguished

## Personas and jobs
- Primary personas: People who already use web AI services and want quick access while working in another app
- User jobs: Ask a quick question, continue a longer conversation, switch between existing AI services
- Key contexts of use: Floating compact window over another application; larger window for focused conversation

## Information architecture
- Primary navigation: ChatGPT is the current Alpha focus
- Core routes/screens: Chat shell and an in-shell settings surface
- Content hierarchy: Provider conversation first; Just Chat controls second; settings only on explicit request. Avoid repeating the app name in the compact window header when its controls already identify the shell.

## Design principles
- Conversation first: Provider content owns the chat surface
- System fit: Shell surfaces and controls follow the operating system's light/dark appearance; avoid a bright shell around a dark conversation.
- Cohesive handoff: The initial composer and ChatGPT page should feel like two states of one quick-chat flow, with a clear, calm transition and consistent spacing, color, and control language.
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
- Supported breakpoints/devices: Desktop windows on macOS and Windows; 900×220 starting Pop Over, 1200×800 Expanded window and Full Screen on the current display
- Layout adaptations: Keep shell controls in a fixed-height header; provider site handles its own responsive layout
- Touch/hover differences: Hover is optional feedback; buttons remain visible and keyboard reachable

## Interaction states
- Loading: Keep the remote page visible while it loads so provider sign-in and browser challenges remain accessible
- Empty: Not applicable; chat empty state belongs to the Provider
- Error: Show a plain retry action for navigation/load failures
- Success: Return control to the Provider web experience
- Disabled: Unimplemented Gemini and Grok choices remain visibly unavailable
- Offline/slow network, if applicable: Do not fake readiness; show loading or retry state

## Composer-to-ChatGPT handoff
- Decision: Keep the quick-entry composer native-feeling and neutral rather than copying ChatGPT's remote composer. Make it feel like one flow through the same shell header, semantic light/dark tokens, spacing rhythm, and concise status feedback.
- Submit behavior: Show a connection-in-progress status while preparing ChatGPT. On success, let the ChatGPT page own the submitted conversation and clear the local draft. On failure, preserve the complete draft and offer a manual-open/paste recovery path.
- Theme ownership: The Just Chat shell follows the system appearance. ChatGPT's remote page keeps its own appearance setting; do not force or imply synchronized remote theming.
- Evidence: `src/renderer/ui/App.tsx` implements progress, success, retained-draft failure, and manual-open feedback; `src/main/index.ts` transfers text and changes to the retained ChatGPT view. Orca verified the shell in light and dark. A direct visual comparison with the ChatGPT conversation page remains unverified while the profile is logged out.

## Content voice
- Tone: Plain, calm, concise
- Terminology: “Pop Over”, “Expanded”, “Full Screen”, “ChatGPT”, “Experimental”
- Microcopy rules: Explain what is unavailable without marketing claims or blame

## Implementation constraints
- Framework/styling system: Electron, React, TypeScript, plain CSS
- Design-token constraints: Extend current neutrals into light/dark semantic CSS variables; derive the shell appearance from the OS preference; avoid introducing a component library
- Performance constraints: Keep Provider WebContentsView instances to preserve state; measure before eviction
- Compatibility constraints: Electron APIs may still differ in window management by OS; verify each platform
- Test/screenshot expectations: Test state logic and controls; capture OS-specific visuals during manual platform verification

## Open questions
- [ ] Confirm through Orca UI review that the unwanted app-name label is gone from the surface the user meant; current code removed the in-window `.brand` label. If the user meant an OS menu-bar item, inspect that platform-specific surface separately.
- [x] Composer direction: use a quieter native-feeling draft surface, with the shell's shared visual language and explicit handoff feedback; do not imitate or theme the remote page. Verify the real transition after normal UI sign-in.
- [ ] Which macOS and Windows versions should be used to verify system light/dark switching and contrast?
- [ ] Should Auto-hide be enabled by default after multi-platform user testing?
- [ ] What is the preferred default macOS shortcut after checking conflicts on supported macOS versions?
- [ ] Which additional auth redirect hosts are actually required for supported Provider login flows?
