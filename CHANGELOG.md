# Changelog

All notable changes to MPDS-MCP are documented here. This project adheres to
[Semantic Versioning](https://semver.org/) (pre-1.0: minor versions may include
additive schema migrations).

## [0.3.0] - 2026-06-24

### Added
- **Standard MCP protocol support** — the `/mcp` JSON-RPC endpoint now implements
  `initialize`, `tools/list`, `tools/call`, `ping`, and `notifications/initialized`,
  so standard MCP clients (Claude Code/Desktop, etc.) can complete the handshake and
  discover the ~36 tools. The existing custom JSON-RPC methods continue to work.
- **`generate_showcase` `format` option** — `format: "html"` returns the raw HTML
  document directly; the default still returns `{ html, ...counts }`.
- **Live component previews** in the showcase — each component card renders a
  best-effort sample element (button/badge/input/avatar/toggle/card/link), derived
  from the component name + variants and styled with the project's design tokens.
- **Design guidelines section** in the showcase (full body, clamp + expand).
- **Token categories `border`, `motion`, `other`** are now accepted (migration
  `004` widens the `tokens.category` CHECK constraint; data-preserving).
- **Child-owned components** — components created directly on a child project are
  now readable, updatable, deletable, and shown first in that project's showcase
  (before inherited parent components).

### Changed
- **Structured component fields accept both shapes** — `variants`, `states`, `props`,
  `usageRules`, and `accessibilityNotes` accept either an array (of strings or
  objects) **or** an object map (e.g. `{ primary: { description } }`). Values are
  stored verbatim and rendered appropriately, instead of being silently coerced.
- Showcase hardening: mobile-responsive layout (no horizontal overflow, 44px nav
  touch targets), in-section nav anchors, proportional spacing bars with a visible
  floor, type-aware typography samples, visible shadow previews on a light backdrop,
  click-to-copy on swatches, and clamp/expand on long pattern/guideline text.

### Fixed
- Component structured fields no longer silently dropped: the read path previously
  coerced any non-array (`Array.isArray ? x : []`) to `[]`, discarding object-map
  values that had been written to storage.
- `update_component` / `delete_component` now operate on child-owned components
  (previously only matched root base specs, returning `COMPONENT_NOT_FOUND`).
- `generate_showcase` no longer crashes (`c.variants.map is not a function`) when a
  component field is stored as a non-array.

## [0.2.0] - prior

- Pattern Library (P2), 23 MCP write tools (P3), and the initial `generate_showcase`
  tool (P4). See git history for details.
