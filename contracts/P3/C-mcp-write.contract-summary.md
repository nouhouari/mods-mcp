# C-mcp-write — P3 Contract Summary

**Spec file:** `contracts/P3/C-mcp-write.openapi.yaml`
**Version:** 3.0.0
**Frozen:** 2026-06-22
**Phase:** P3

---

## Why write methods were added to the MCP endpoint

P1 gave AI agents read-only tools (list, get, validate). P2 added the Pattern Library via REST.
P3 closes the loop: AI agents now need to **build** the design system, not just read it.

The motivation is a full "design-system-as-code" authoring workflow driven by natural language:
a designer describes intent, the AI agent translates it into structured API calls that create
projects, populate tokens, define component specs, and document patterns — all in a single
conversational loop, without a human manually POSTing REST payloads.

The transport stays on the existing `POST /mcp` endpoint (JSON-RPC 2.0) introduced in P1.
Adding 23 new `method` values is a **non-breaking additive change** to the existing MCP surface:
old clients that do not send the new methods are unaffected.

---

## Design decisions

### Single endpoint, method-dispatched

JSON-RPC maps poorly to REST resource paths, and introducing 23 new REST paths would bloat the
surface without benefit for the AI-agent use case. All write methods go through `POST /mcp`,
identical to the existing P1 read tools. The `method` field is the discriminator.

### Error transport

Application-level errors ride on HTTP 200 (JSON-RPC convention), with domain details in
`error.data.code` (a stable string token) and `error.data.message`. The JSON-RPC numeric
`error.code` carries the standard category (-32602 invalid params / -32603 internal error).
This matches P1/P2's existing error envelope philosophy — "use `code` for logic, never parse
`message`" — but lifted into the JSON-RPC layer.

### Optimistic concurrency (OCC)

`update_token`, `set_token`, and `delete_token` all require `version` in params.
`update_component` requires `version` in params.
The caller must obtain the current version by calling `get_token` or `get_component_spec` first.
A stale version returns `VERSION_MISMATCH` (-32603 with `data.code = "VERSION_MISMATCH"`).

This is the same OCC contract as the P1 REST `PUT /api/projects/:id/tokens/:key` (via `If-Match`
header), translated into the JSON-RPC param style appropriate for AI agent callers.

### Pattern ID format

Pattern IDs must be **kebab-case**: lowercase alphanumeric segments separated by hyphens
(`^[a-z0-9]+(-[a-z0-9]+)*$`). Examples: `card-hero`, `btn-group`, `layout-grid`.
Violations return `INVALID_PATTERN_ID` (-32602).

---

## Method table — all 23 P3 write methods

### Projects (3 methods)

| Method | Required params | Optional params | Success result | Key error codes |
|---|---|---|---|---|
| `create_project` | `id`, `name` | `parentId` | `Project` | `DUPLICATE_PROJECT_ID`, `PROJECT_NOT_FOUND` (parent) |
| `update_project` | `projectId`, `name` | — | `Project` | `PROJECT_NOT_FOUND` |
| `delete_project` | `projectId` | — | `{ success: true }` | `PROJECT_NOT_FOUND`, `BASE_HAS_CHILDREN`, `PROJECT_HAS_TOKENS` |

### Tokens (7 methods)

| Method | Required params | Optional params | Success result | Key error codes |
|---|---|---|---|---|
| `list_tokens` | `projectId` | `category` | `{ tokens: ResolvedToken[] }` | `PROJECT_NOT_FOUND`, `INVALID_CATEGORY` |
| `get_token` | `projectId`, `key` | — | `Token` | `PROJECT_NOT_FOUND`, `TOKEN_NOT_FOUND` |
| `create_token` | `projectId`, `key`, `category`, `value` | `isSemantic`, `semanticRef` | `Token` | `DUPLICATE_TOKEN`, `PROJECT_NOT_FOUND`, `INVALID_CATEGORY` |
| `update_token` | `projectId`, `key`, `version` | `value`, `semanticRef` | `Token` | `TOKEN_NOT_FOUND`, `VERSION_MISMATCH`, `CONFLICT` |
| `set_token` | `projectId`, `key`, `value`, `version` | — | `Token` | `TOKEN_NOT_FOUND`, `PROJECT_NOT_FOUND`, `VERSION_MISMATCH` |
| `delete_token` | `projectId`, `key`, `version` | — | `{ success: true }` | `TOKEN_NOT_FOUND`, `VERSION_MISMATCH`, `TOKEN_REFERENCED_BY_SEMANTIC` |
| `delete_token_override` | `projectId`, `key` | — | `{ success: true }` | `TOKEN_NOT_FOUND`, `PROJECT_NOT_FOUND` |

**OCC note for tokens:** `update_token`, `set_token`, and `delete_token` all require the caller to
supply `version` (an integer). Obtain it by calling `get_token` first. A mismatched version
yields `VERSION_MISMATCH`; the caller must re-fetch and retry.

### Components (3 methods)

| Method | Required params | Optional params | Success result | Key error codes |
|---|---|---|---|---|
| `create_component` | `projectId`, `id`, `name` | `description`, `props`, `variants`, `states`, `usageRules`, `accessibilityNotes` | `ComponentSpec` | `DUPLICATE_COMPONENT_ID`, `PROJECT_NOT_FOUND` |
| `update_component` | `projectId`, `componentId`, `version` | `name`, `description`, `props`, `variants`, `states`, `usageRules`, `accessibilityNotes` | `ComponentSpec` | `COMPONENT_NOT_FOUND`, `VERSION_MISMATCH`, `CONFLICT` |
| `delete_component` | `projectId`, `componentId` | — | `{ success: true }` | `COMPONENT_NOT_FOUND` |

**OCC note for components:** `update_component` requires `version`. Obtain it by calling
`get_component_spec` (P1 read tool) first. Array fields (`props`, `variants`, `states`,
`usageRules`, `accessibilityNotes`) **replace** the entire array on the stored spec — they do not
merge.

### Patterns (10 methods)

| Method | Required params | Optional params | Success result | Key error codes |
|---|---|---|---|---|
| `create_pattern` | `projectId`, `id`, `name`, `category` | `description`, `tags`, `guidanceUrl` | `Pattern` | `DUPLICATE_PATTERN_ID`, `INVALID_PATTERN_ID`, `INVALID_PATTERN_CATEGORY`, `PROJECT_NOT_FOUND` |
| `update_pattern` | `projectId`, `patternId` | `name`, `description`, `tags`, `guidanceUrl` | `Pattern` | `PATTERN_NOT_FOUND` |
| `delete_pattern` | `projectId`, `patternId` | — | `{ success: true }` | `PATTERN_NOT_FOUND`, `PATTERN_IN_USE` |
| `create_variant` | `projectId`, `patternId`, `name`, `appliesAt` | `description` | `PatternVariant` | `PATTERN_NOT_FOUND`, `PROJECT_NOT_FOUND` |
| `update_variant` | `projectId`, `patternId`, `variantId` | `name`, `appliesAt`, `description` | `PatternVariant` | `PATTERN_NOT_FOUND` |
| `delete_variant` | `projectId`, `patternId`, `variantId` | — | `{ success: true }` | `PATTERN_NOT_FOUND` |
| `create_composition_rule` | `projectId`, `patternAId`, `patternBId`, `relation` | `guidance` | `CompositionRule` | `PATTERN_NOT_FOUND`, `DUPLICATE_COMPOSITION_RULE`, `INVALID_RELATION` |
| `delete_composition_rule` | `projectId`, `ruleId` | — | `{ success: true }` | `COMPOSITION_RULE_NOT_FOUND` |
| `create_layout_guideline` | `projectId`, `type`, `name`, `data` | `description` | `LayoutGuideline` | `PROJECT_NOT_FOUND`, `INVALID_TYPE` |
| `update_layout_guideline` | `projectId`, `guidelineId` | `name`, `description`, `data` | `LayoutGuideline` | `GUIDELINE_NOT_FOUND` |
| `delete_layout_guideline` | `projectId`, `guidelineId` | — | `{ success: true }` | `GUIDELINE_NOT_FOUND`, `GUIDELINE_IN_USE` |

---

## Enum constraints

### `relation` (CompositionRelation)
Values: `NESTING_ALLOWED` | `NESTING_FORBIDDEN` | `OVERRIDE_CAUTION` | `SIBLING_ONLY` | `EXCLUSIVE`

Violations return `INVALID_RELATION` (-32602).

### `type` (GuidelineType)
Values: `breakpoints` | `spacing` | `grid` | `alignment` | `typography` | `animation`

Violations return `INVALID_TYPE` (-32602).

### `appliesAt` (BreakpointName)
Values: `mobile` | `tablet` | `desktop` | `wide`

### `category` (PatternCategory)
Values: `layout` | `component` | `interaction` | `accessibility` | `animation` | `spacing` | `color` | `typography`

Violations return `INVALID_PATTERN_CATEGORY` (-32602).

### `category` (TokenCategory)
Values: `color` | `spacing` | `typography` | `radius` | `shadow` | `breakpoint`

Violations return `INVALID_CATEGORY` (-32602).

### Pattern `id` format
Must match `^[a-z0-9]+(-[a-z0-9]+)*$` (kebab-case, e.g. `card-hero`, `btn-group`).
Violations return `INVALID_PATTERN_ID` (-32602).

---

## Error handling

All errors follow the same envelope established in P1/P2, lifted into JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "id": <id>,
  "error": {
    "code": <json-rpc-numeric-code>,
    "message": "<short-summary>",
    "data": {
      "code": "<DOMAIN_ERROR_CODE>",
      "message": "<human-readable detail>"
    }
  }
}
```

**Rule:** use `error.data.code` for programmatic logic. Never parse `error.data.message`.
The `error.message` field is a short JSON-RPC summary string — also unstable prose, not for logic.

Auth failures (missing/invalid token) return HTTP 401 with the REST error envelope
`{ "error": { "code": "...", "message": "..." } }` — they do not produce a JSON-RPC response.

### Complete error code registry (P3 additions in bold)

| Domain | Code | Trigger |
|---|---|---|
| Auth | `MISSING_AUTH_HEADER` | No Authorization header |
| Auth | `INVALID_TOKEN` | Wrong/empty bearer value |
| Auth | `INVALID_AUTH_SCHEME` | Non-Bearer scheme |
| Registry | `PROJECT_NOT_FOUND` | projectId does not exist |
| Registry | `DUPLICATE_PROJECT_ID` | id already in use |
| Registry | `BASE_HAS_CHILDREN` | Delete blocked by child projects |
| Registry | `PROJECT_HAS_TOKENS` | Delete blocked by existing tokens |
| Registry | `CONFLICT` | Concurrent modification |
| Token | `TOKEN_NOT_FOUND` | key not found in project |
| Token | `DUPLICATE_TOKEN` | key already exists in project |
| Token | `INVALID_CATEGORY` | Unknown category value |
| Token | **`VERSION_MISMATCH`** | OCC version does not match stored version |
| Token | `TOKEN_REFERENCED_BY_SEMANTIC` | Delete blocked by semantic reference |
| Token | `CONFLICT` | Concurrent modification |
| Component | `COMPONENT_NOT_FOUND` | componentId not found |
| Component | `DUPLICATE_COMPONENT_ID` | id already exists in project |
| Component | **`VERSION_MISMATCH`** | OCC version does not match stored version |
| Component | `CONFLICT` | Concurrent modification |
| Pattern | `PATTERN_NOT_FOUND` | patternId not found |
| Pattern | `DUPLICATE_PATTERN_ID` | id already exists in project |
| Pattern | `INVALID_PATTERN_ID` | id does not match kebab-case format |
| Pattern | `INVALID_PATTERN_CATEGORY` | Unknown category value |
| Pattern | `PATTERN_IN_USE` | Delete blocked by composition rules |
| Composition | `DUPLICATE_COMPOSITION_RULE` | Rule pair already exists |
| Composition | `COMPOSITION_RULE_NOT_FOUND` | ruleId not found |
| Composition | **`INVALID_RELATION`** | relation not in allowed enum |
| Guideline | `GUIDELINE_NOT_FOUND` | guidelineId not found |
| Guideline | `GUIDELINE_IN_USE` | Delete blocked by pattern references |
| Guideline | **`INVALID_TYPE`** | type not in allowed enum |

---

## Versioning and backward compatibility

P3 is additive: 23 new `method` values are added to the `POST /mcp` dispatcher.
No existing P1 or P2 methods, params, or response shapes are changed.

Breaking-change detection target: diff `contracts/P3/C-mcp-write.openapi.yaml` against any
future revision using `oasdiff breaking` or equivalent. The following are breaking changes and
require a version bump to 4.0.0:

- Removing any existing method from the `method` enum
- Changing a required param to a different name or type
- Removing a field from a success result schema
- Tightening an enum (removing values)
- Changing an error code string for an existing condition

The following are safe and non-breaking:

- Adding new optional params
- Adding new fields to result objects
- Adding new method values to the enum
- Adding new error codes for new error conditions
