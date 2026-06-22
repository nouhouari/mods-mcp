# C-mcp-write — Worked Examples (P3)

All calls go to `POST /mcp` with `Content-Type: application/json` and
`Authorization: Bearer <secret>`. Responses are always HTTP 200 (success or domain error);
HTTP 401 only for auth failures.

Replace `http://localhost:3100` and `<secret>` with your actual values.

---

## create_project

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "create_project",
    "params": {
      "id": "proj-acme",
      "name": "Acme Web App",
      "parentId": "base"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "proj-acme",
    "name": "Acme Web App",
    "parentId": "base",
    "createdAt": "2026-06-22T10:00:00.000Z"
  }
}
```

Error (duplicate ID):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "DUPLICATE_PROJECT_ID",
      "message": "A project with id 'proj-acme' already exists."
    }
  }
}
```

---

## update_project

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "update_project",
    "params": {
      "projectId": "proj-acme",
      "name": "Acme Web App (Redesign)"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "id": "proj-acme",
    "name": "Acme Web App (Redesign)",
    "parentId": "base",
    "createdAt": "2026-06-22T10:00:00.000Z"
  }
}
```

---

## delete_project

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "delete_project",
    "params": {
      "projectId": "proj-acme"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "success": true
  }
}
```

Error (has child projects):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "BASE_HAS_CHILDREN",
      "message": "Cannot delete project 'proj-acme': child projects exist."
    }
  }
}
```

---

## list_tokens

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "list_tokens",
    "params": {
      "projectId": "proj-acme",
      "category": "color"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "tokens": [
      {
        "key": "color.primary.500",
        "category": "color",
        "value": "#0066CC",
        "source": "base",
        "isSemantic": false
      },
      {
        "key": "color.text.primary",
        "category": "color",
        "value": "#0052A3",
        "source": "override",
        "isSemantic": true,
        "semanticRef": "color.primary.500"
      }
    ]
  }
}
```

---

## get_token

Use the returned `version` field for subsequent `update_token`, `set_token`, or `delete_token` calls.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "get_token",
    "params": {
      "projectId": "proj-acme",
      "key": "color.primary.500"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "id": "tok-001",
    "projectId": "proj-acme",
    "key": "color.primary.500",
    "category": "color",
    "value": "#0066CC",
    "isSemantic": false,
    "version": 2
  }
}
```

---

## create_token

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "create_token",
    "params": {
      "projectId": "base",
      "key": "color.primary.500",
      "category": "color",
      "value": "#0066CC",
      "isSemantic": false
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "id": "tok-002",
    "projectId": "base",
    "key": "color.primary.500",
    "category": "color",
    "value": "#0066CC",
    "isSemantic": false,
    "version": 0
  }
}
```

Error (duplicate key):
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "DUPLICATE_TOKEN",
      "message": "Token 'color.primary.500' already exists in project 'base'."
    }
  }
}
```

---

## update_token

Requires `version` from a prior `get_token` call (OCC guard).

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "update_token",
    "params": {
      "projectId": "base",
      "key": "color.primary.500",
      "version": 2,
      "value": "#0052A3"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "id": "tok-002",
    "projectId": "base",
    "key": "color.primary.500",
    "category": "color",
    "value": "#0052A3",
    "isSemantic": false,
    "version": 3
  }
}
```

Error (stale version):
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "code": "VERSION_MISMATCH",
      "message": "Token 'color.primary.500' version mismatch: expected 2, got 1. Re-fetch and retry."
    }
  }
}
```

---

## set_token

Creates or replaces a project-level override. Requires `version` from `get_token`.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 8,
    "method": "set_token",
    "params": {
      "projectId": "proj-acme",
      "key": "color.primary.500",
      "value": "#003D8F",
      "version": 2
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "id": "tok-003",
    "projectId": "proj-acme",
    "key": "color.primary.500",
    "category": "color",
    "value": "#003D8F",
    "isSemantic": false,
    "version": 3
  }
}
```

---

## delete_token

Permanently removes a token. Requires `version` (OCC guard).

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "delete_token",
    "params": {
      "projectId": "base",
      "key": "color.deprecated.300",
      "version": 1
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "success": true
  }
}
```

Error (semantic dependency):
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "TOKEN_REFERENCED_BY_SEMANTIC",
      "message": "Token 'color.deprecated.300' is referenced by one or more semantic tokens."
    }
  }
}
```

---

## delete_token_override

Reverts a project override, restoring the base value. No version required.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 10,
    "method": "delete_token_override",
    "params": {
      "projectId": "proj-acme",
      "key": "color.primary.500"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "success": true
  }
}
```

---

## create_component

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 11,
    "method": "create_component",
    "params": {
      "projectId": "base",
      "id": "btn-primary",
      "name": "Primary Button",
      "description": "The main call-to-action button.",
      "props": [
        { "name": "label", "type": "string", "required": true, "description": "Visible button label text." },
        { "name": "disabled", "type": "boolean", "required": false, "default": "false" }
      ],
      "variants": ["default", "destructive", "outline"],
      "states": ["default", "hover", "focus-visible", "disabled"],
      "usageRules": ["Use for the primary action on a page.", "Limit to one per view."],
      "accessibilityNotes": ["Must have a visible focus indicator (WCAG 2.4.7)."]
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "result": {
    "id": "btn-primary",
    "projectId": "base",
    "name": "Primary Button",
    "description": "The main call-to-action button.",
    "props": [
      { "name": "label", "type": "string", "required": true, "description": "Visible button label text." },
      { "name": "disabled", "type": "boolean", "required": false, "default": "false" }
    ],
    "variants": ["default", "destructive", "outline"],
    "states": ["default", "hover", "focus-visible", "disabled"],
    "usageRules": ["Use for the primary action on a page.", "Limit to one per view."],
    "accessibilityNotes": ["Must have a visible focus indicator (WCAG 2.4.7)."],
    "version": 0
  }
}
```

---

## update_component

Requires `version` from a prior `get_component_spec` (P1 read tool) call (OCC guard).
Array fields replace, not merge.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 12,
    "method": "update_component",
    "params": {
      "projectId": "base",
      "componentId": "btn-primary",
      "version": 1,
      "description": "The main CTA button — updated for dark-mode compliance.",
      "accessibilityNotes": [
        "Must have a visible focus indicator (WCAG 2.4.7).",
        "Label must be descriptive (WCAG 4.1.2)."
      ]
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": {
    "id": "btn-primary",
    "projectId": "base",
    "name": "Primary Button",
    "description": "The main CTA button — updated for dark-mode compliance.",
    "props": [
      { "name": "label", "type": "string", "required": true }
    ],
    "variants": ["default", "destructive", "outline"],
    "states": ["default", "hover", "focus-visible", "disabled"],
    "usageRules": ["Use for the primary action on a page.", "Limit to one per view."],
    "accessibilityNotes": [
      "Must have a visible focus indicator (WCAG 2.4.7).",
      "Label must be descriptive (WCAG 4.1.2)."
    ],
    "version": 2
  }
}
```

Error (stale version):
```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "code": "VERSION_MISMATCH",
      "message": "Component 'btn-primary' version mismatch: expected 1, got 0. Re-fetch and retry."
    }
  }
}
```

---

## delete_component

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 13,
    "method": "delete_component",
    "params": {
      "projectId": "base",
      "componentId": "btn-legacy"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 13,
  "result": {
    "success": true
  }
}
```

---

## create_pattern

Pattern `id` must be kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`).

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 14,
    "method": "create_pattern",
    "params": {
      "projectId": "proj-acme",
      "id": "card-hero",
      "name": "Hero Card",
      "category": "layout",
      "description": "Full-width card with image, title, and CTA button.",
      "tags": ["responsive", "accessibility"],
      "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 14,
  "result": {
    "id": "card-hero",
    "projectId": "proj-acme",
    "name": "Hero Card",
    "category": "layout",
    "description": "Full-width card with image, title, and CTA button.",
    "tags": ["responsive", "accessibility"],
    "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card",
    "variants": [],
    "relatedComponents": [],
    "compositionRules": [],
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
}
```

Error (invalid ID format):
```json
{
  "jsonrpc": "2.0",
  "id": 14,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "INVALID_PATTERN_ID",
      "message": "'Card Hero' is not a valid pattern ID. Must match ^[a-z0-9]+(-[a-z0-9]+)*$."
    }
  }
}
```

---

## update_pattern

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 15,
    "method": "update_pattern",
    "params": {
      "projectId": "proj-acme",
      "patternId": "card-hero",
      "name": "Hero Card (v2)",
      "description": "Full-width hero card with badge support.",
      "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card/v2"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 15,
  "result": {
    "id": "card-hero",
    "projectId": "proj-acme",
    "name": "Hero Card (v2)",
    "category": "layout",
    "description": "Full-width hero card with badge support.",
    "tags": ["responsive", "accessibility"],
    "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card/v2",
    "variants": [],
    "relatedComponents": [],
    "compositionRules": [],
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:05:00.000Z"
  }
}
```

---

## delete_pattern

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 16,
    "method": "delete_pattern",
    "params": {
      "projectId": "proj-acme",
      "patternId": "card-deprecated"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 16,
  "result": {
    "success": true
  }
}
```

Error (pattern in use):
```json
{
  "jsonrpc": "2.0",
  "id": 16,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "PATTERN_IN_USE",
      "message": "Cannot delete pattern 'card-deprecated': 2 composition rules reference it."
    }
  }
}
```

---

## create_variant

`appliesAt` must be one of: `mobile` | `tablet` | `desktop` | `wide`.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 17,
    "method": "create_variant",
    "params": {
      "projectId": "proj-acme",
      "patternId": "card-hero",
      "name": "mobile",
      "appliesAt": "mobile",
      "description": "Stack vertically on small screens."
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "result": {
    "id": "variant-mobile",
    "name": "mobile",
    "description": "Stack vertically on small screens.",
    "appliesAt": "mobile",
    "createdAt": "2026-06-22T10:10:00.000Z"
  }
}
```

---

## update_variant

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 18,
    "method": "update_variant",
    "params": {
      "projectId": "proj-acme",
      "patternId": "card-hero",
      "variantId": "variant-mobile",
      "description": "Stack vertically; hide badge on screens below 480px."
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 18,
  "result": {
    "id": "variant-mobile",
    "name": "mobile",
    "description": "Stack vertically; hide badge on screens below 480px.",
    "appliesAt": "mobile",
    "createdAt": "2026-06-22T10:10:00.000Z"
  }
}
```

---

## delete_variant

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 19,
    "method": "delete_variant",
    "params": {
      "projectId": "proj-acme",
      "patternId": "card-hero",
      "variantId": "variant-wide"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 19,
  "result": {
    "success": true
  }
}
```

---

## create_composition_rule

`relation` must be one of: `NESTING_ALLOWED` | `NESTING_FORBIDDEN` | `OVERRIDE_CAUTION` | `SIBLING_ONLY` | `EXCLUSIVE`.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 20,
    "method": "create_composition_rule",
    "params": {
      "projectId": "proj-acme",
      "patternAId": "card-hero",
      "patternBId": "layout-grid",
      "relation": "NESTING_ALLOWED",
      "guidance": "Hero cards can be placed inside grid layouts; ensure 16px spacing."
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "result": {
    "id": "rule-card-inside-grid",
    "projectId": "proj-acme",
    "patternAId": "card-hero",
    "patternBId": "layout-grid",
    "relation": "NESTING_ALLOWED",
    "guidance": "Hero cards can be placed inside grid layouts; ensure 16px spacing.",
    "createdAt": "2026-06-22T10:00:00.000Z"
  }
}
```

Error (invalid relation):
```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "INVALID_RELATION",
      "message": "'NESTING_OK' is not a valid relation. Use: NESTING_ALLOWED, NESTING_FORBIDDEN, OVERRIDE_CAUTION, SIBLING_ONLY, EXCLUSIVE."
    }
  }
}
```

Error (duplicate rule):
```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "DUPLICATE_COMPOSITION_RULE",
      "message": "A composition rule already exists for patterns 'card-hero' and 'layout-grid'."
    }
  }
}
```

---

## delete_composition_rule

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 21,
    "method": "delete_composition_rule",
    "params": {
      "projectId": "proj-acme",
      "ruleId": "rule-card-inside-grid"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 21,
  "result": {
    "success": true
  }
}
```

---

## create_layout_guideline

`type` must be one of: `breakpoints` | `spacing` | `grid` | `alignment` | `typography` | `animation`.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 22,
    "method": "create_layout_guideline",
    "params": {
      "projectId": "proj-acme",
      "type": "spacing",
      "name": "Spacing Scale",
      "description": "Standard spacing values in pixels.",
      "data": {
        "xs": 4,
        "sm": 8,
        "md": 16,
        "lg": 24,
        "xl": 32,
        "xxl": 48
      }
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 22,
  "result": {
    "id": "guideline-spacing",
    "projectId": "proj-acme",
    "type": "spacing",
    "name": "Spacing Scale",
    "description": "Standard spacing values in pixels.",
    "data": {
      "xs": 4,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32,
      "xxl": 48
    },
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
}
```

Error (invalid type):
```json
{
  "jsonrpc": "2.0",
  "id": 22,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "INVALID_TYPE",
      "message": "'margins' is not a valid guideline type. Use: breakpoints, spacing, grid, alignment, typography, animation."
    }
  }
}
```

---

## update_layout_guideline

`data` replaces the entire stored data object.

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 23,
    "method": "update_layout_guideline",
    "params": {
      "projectId": "proj-acme",
      "guidelineId": "guideline-spacing",
      "name": "Spacing Scale (v2)",
      "data": {
        "xs": 2,
        "sm": 8,
        "md": 16,
        "lg": 24,
        "xl": 32,
        "xxl": 48
      }
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 23,
  "result": {
    "id": "guideline-spacing",
    "projectId": "proj-acme",
    "type": "spacing",
    "name": "Spacing Scale (v2)",
    "description": "Standard spacing values in pixels.",
    "data": {
      "xs": 2,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32,
      "xxl": 48
    },
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:15:00.000Z"
  }
}
```

---

## delete_layout_guideline

Request:
```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 24,
    "method": "delete_layout_guideline",
    "params": {
      "projectId": "proj-acme",
      "guidelineId": "guideline-deprecated-breakpoints"
    }
  }' | jq
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 24,
  "result": {
    "success": true
  }
}
```

Error (guideline in use):
```json
{
  "jsonrpc": "2.0",
  "id": 24,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "GUIDELINE_IN_USE",
      "message": "Cannot delete guideline 'guideline-deprecated-breakpoints': referenced by 3 patterns."
    }
  }
}
```

---

## Auth failure (applies to all methods)

HTTP 401 — returned before JSON-RPC processing:

```json
{
  "error": {
    "code": "MISSING_AUTH_HEADER",
    "message": "Authorization header is required."
  }
}
```

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided bearer token is invalid."
  }
}
```
