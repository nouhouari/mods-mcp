# C-mcp-showcase Contract Summary — Phase 4

**Frozen:** 2026-06-22
**Spec file:** `contracts/P4/C-mcp-showcase.openapi.yaml`
**API version:** 4.0.0

---

## What this contract adds

One new MCP JSON-RPC 2.0 method dispatched through the existing `POST /mcp` endpoint:

| Method             | Params                              | Result                                           |
|--------------------|-------------------------------------|--------------------------------------------------|
| `generate_showcase`| `projectId` (req), `title` (opt)    | `{ html, tokenCount, componentCount, patternCount }` |

No existing P1/P2/P3 methods are changed. No new HTTP paths. No schema removals.

---

## Design decisions

### Why MCP tool, not a REST endpoint

The showcase is consumed by AI agents and CLI pipelines, not browsers calling REST
resources directly. Keeping it on `POST /mcp` means:

- The agent can call `generate_showcase` in the same conversation turn as
  `list_tokens` or `create_component` — same transport, same auth header, same error
  model.
- No new path to document, version, or secure independently.
- The agent can pipe the result to a file (`jq -r '.result.html' > showcase.html`)
  or attach it to a message without any transformation.

### Why HTML string, not structured JSON

Returning structured JSON (a `{ tokens: [...], components: [...] }` payload) would
force every consumer to implement its own renderer before the output is usable. A
self-contained HTML string is immediately useful:

- Open in any browser: `open /tmp/showcase.html`.
- Embed in an iframe.
- Attach to a Slack/email message.
- Commit to a docs site as a static artifact.

The counts (`tokenCount`, `componentCount`, `patternCount`) are included alongside
`html` so the agent can log or assert on them without parsing the HTML string.

### Why self-contained HTML (no CDN, no external deps)

- Works offline — no network call at page-open time.
- No CORS issues when opened from `file://`.
- No dependency on CDN availability or versioning.
- Safe to commit to a repo or share as an attachment — the file is the whole page.
- Simpler security posture: no CSP directives needed for external origins.

All CSS is inlined in a `<style>` block. No `<script>` tags. No external fonts,
icons, or images.

### Token → CSS custom property mapping

Every resolved token is emitted in a `:root { }` block for potential re-use in
custom styles applied on top of the page. The mapping rule is deterministic:

```
<key>   →  --token-<key with dots replaced by hyphens>

color.primary.500      →  --token-color-primary-500
spacing.md             →  --token-spacing-md
typography.size.body   →  --token-typography-size-body
radius.lg              →  --token-radius-lg
shadow.card            →  --token-shadow-card
breakpoint.tablet      →  --token-breakpoint-tablet
```

The `--token-` prefix avoids collisions with author-defined variables.

### Color palette rendering

The color section uses a responsive CSS grid (auto-fill, ~160px min column width).
Each swatch is a `<div>` with:

- A filled rectangle (`background-color: <resolved value>`) — the visual.
- The token key rendered in a small monospace font below.
- The hex/value string.
- A source badge: `base` (neutral) or `override` (highlighted) — so consumers can
  instantly see which colors are customised for this project.
- For semantic tokens: an additional badge showing the resolved primitive key
  (`→ color.primary.500`).

### Component gallery

The server has no browser, so components cannot be live-rendered. Each card shows
the spec documentation:

- Name and description.
- Props table: name | type | required | default | description.
- Variants and states as tag lists.
- Usage rules as a bullet list.
- Accessibility notes as a bullet list.

This is a documentation preview, equivalent to reading the component spec directly,
but formatted for quick scanning.

### Pattern catalog

One card per pattern in `listPatterns` order. Shown: name, category badge,
description, tags, guidance URL (if present, rendered as a link), created/updated
timestamps.

### Empty sections

A section (`<section>`) is omitted entirely from the HTML when its count is zero.
This keeps the page clean for projects that, for example, have tokens but no
components yet. The counts in the result payload reflect what was rendered.

### Title defaulting

When `title` is omitted, the page title and visible `<h1>` default to
`"{project.name} Design System"` where `project.name` is read from `getProject(id)`.
This means the caller never has to look up the project name separately.

---

## Error codes

| Domain code         | JSON-RPC code | HTTP status | Trigger                              |
|---------------------|---------------|-------------|--------------------------------------|
| `PROJECT_NOT_FOUND` | -32602        | 200         | `projectId` absent from registry     |
| (none)              | -32602        | 200         | `projectId` param missing entirely   |
| `MISSING_AUTH_HEADER` | —           | 401         | No Authorization header              |
| `INVALID_TOKEN`     | —             | 401         | Wrong bearer token                   |
| `INVALID_AUTH_SCHEME` | —           | 401         | Non-Bearer auth scheme               |

No new domain error codes are introduced. `PROJECT_NOT_FOUND` already exists in
the P3 error vocabulary and is re-used here.

---

## Security notes

`generate_showcase` is a **read-only** tool. It calls three existing read functions
(`getProject`, `resolveTokens`, `listSpecs`, `listPatterns`) and performs no writes.
Auth is enforced identically to all other `/mcp` methods — `Bearer <MCP_SECRET>`
required; auth failures return HTTP 401 before the JSON-RPC dispatcher runs.

The HTML output is generated server-side from database content. Because the output
contains no `<script>` tags and no external resource URLs, XSS via stored token
values is not a vector in the generated page — values are HTML-entity-escaped when
inserted into the DOM. Implementers must apply standard HTML escaping to all
interpolated values (token keys, values, component names, pattern descriptions).

---

## What was deliberately omitted

- **Dark mode toggle** — deferred; would require inline JS, which conflicts with the
  no-script constraint. A future `generate_showcase_v2` could relax this.
- **Live component rendering** — not possible without a headless browser; out of scope
  for a server-side tool.
- **PDF export** — deferred; callers can use `wkhtmltopdf` or `puppeteer` on the
  emitted HTML independently.
- **Pagination of patterns** — `listPatterns` is called with default `limit`/`offset`;
  the tool fetches all patterns up to the default page limit. For very large catalogs,
  a `maxPatterns` param could be added in a future revision without a breaking change.
- **i18n** — the page is English-only; locale support is not in scope for P4.
