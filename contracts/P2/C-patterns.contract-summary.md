# C-patterns OpenAPI 3.1.0 Contract

**File:** `C-patterns.openapi.yaml`  
**Status:** FROZEN — do not edit without re-freezing (run lint + breaking-change detection)  
**Phase:** P2 (Phase 2, ships after P1 MVP)  
**Date Frozen:** 2026-06-14  

## Overview

The C-patterns module extends MPDS-MCP with **design pattern management**, **composition rules**, and **layout guidelines**. Patterns are reusable UI/interaction design patterns documented with metadata, responsive variants, composition constraints, and layout guidance.

All patterns are **project-scoped** — they inherit from parent projects (like tokens and components), support project-level overrides, and can reference layout guidelines and composition rules.

## API Surface

### 9 Primary Paths

| Path | Operations | Purpose |
|------|-----------|---------|
| `/api/projects/{projectId}/patterns` | GET, POST | List/create patterns |
| `/api/projects/{projectId}/patterns/{patternId}` | GET, PUT, DELETE | Get/update/delete single pattern |
| `/api/projects/{projectId}/patterns/{patternId}/variants` | POST | Add responsive variant to pattern |
| `/api/projects/{projectId}/patterns/{patternId}/variants/{variantId}` | DELETE | Delete pattern variant |
| `/api/projects/{projectId}/composition-rules` | GET, POST | List/create composition rules |
| `/api/projects/{projectId}/composition-rules/{ruleId}` | GET, PUT, DELETE | Get/update/delete single rule |
| `/api/projects/{projectId}/layout-guidelines` | GET, POST | List/create layout guidelines |
| `/api/projects/{projectId}/layout-guidelines/{guidelineId}` | GET, PUT, DELETE | Get/update/delete single guideline |
| `/api/projects/{projectId}/patterns/{patternId}/validate-usage` | POST | Validate pattern against composition rules |

## Core Concepts

### 1. Patterns (Pattern Catalog)
Reusable UI/interaction design patterns with:
- **ID** — kebab-case identifier (e.g., `card-hero`, `btn-group`)
- **Category** — layout, component, interaction, accessibility, animation, spacing, color, or typography
- **Metadata** — name, description, tags, guidance URL
- **Variants** — responsive implementations (mobile, tablet, desktop, wide)
- **Relations** — related components and composition rules

**Request Example (Create Pattern):**
```json
{
  "id": "card-hero",
  "name": "Hero Card",
  "category": "layout",
  "description": "Full-width card with image, title, CTA button, and optional badge.",
  "tags": ["responsive", "accessibility", "cta"],
  "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card",
  "variants": [
    {
      "name": "mobile",
      "description": "Stack vertically on small screens.",
      "appliesAt": "mobile"
    },
    {
      "name": "desktop",
      "description": "Side-by-side image and text on large screens.",
      "appliesAt": "desktop"
    }
  ]
}
```

**Response Example (200 Created):**
```json
{
  "id": "card-hero",
  "projectId": "proj-acme",
  "name": "Hero Card",
  "category": "layout",
  "description": "Full-width card with image, title, CTA button, and optional badge.",
  "tags": ["responsive", "accessibility", "cta"],
  "guidanceUrl": "https://design-docs.acme.com/patterns/hero-card",
  "variants": [
    {
      "id": "variant-mobile",
      "name": "mobile",
      "description": "Stack vertically on small screens.",
      "appliesAt": "mobile",
      "createdAt": "2026-06-13T10:00:00.000Z"
    },
    {
      "id": "variant-desktop",
      "name": "desktop",
      "description": "Side-by-side image and text on large screens.",
      "appliesAt": "desktop",
      "createdAt": "2026-06-13T10:00:00.000Z"
    }
  ],
  "relatedComponents": [],
  "compositionRules": [],
  "createdAt": "2026-06-13T10:00:00.000Z",
  "updatedAt": "2026-06-13T10:00:00.000Z"
}
```

### 2. Composition Rules
Documents constraints and permissions for combining patterns:
- **NESTING_ALLOWED** — patternA can nest safely inside patternB
- **NESTING_FORBIDDEN** — patternA must not nest inside patternB
- **OVERRIDE_CAUTION** — patterns coexist but with caveats (documented in guidance)
- **SIBLING_ONLY** — patterns are siblings but not nested
- **EXCLUSIVE** — patterns cannot appear together in the same view

**Request Example (Create Composition Rule):**
```json
{
  "patternAId": "card-hero",
  "patternBId": "layout-grid",
  "relation": "NESTING_ALLOWED",
  "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline."
}
```

**Response Example (201 Created):**
```json
{
  "id": "rule-card-inside-grid",
  "projectId": "proj-acme",
  "patternAId": "card-hero",
  "patternBId": "layout-grid",
  "relation": "NESTING_ALLOWED",
  "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline.",
  "createdAt": "2026-06-01T00:00:00.000Z"
}
```

### 3. Layout Guidelines
Responsive breakpoints, spacing scales, grid rules, alignment, typography, and animation conventions:
- **breakpoints** — mobile/tablet/desktop/wide definitions with min/max widths
- **spacing** — xs, sm, md, lg, xl, xxl values (pixels or rem)
- **grid** — columns, gap, alignment parameters
- **alignment** — horizontal/vertical justification options
- **typography** — font sizes, weights, line heights, letter spacing
- **animation** — timing, easing, duration presets

**Request Example (Create Layout Guideline):**
```json
{
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
```

**Response Example (201 Created):**
```json
{
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
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

### 4. Pattern Validation
Validates pattern usage against composition rules and layout guidelines:

**Request Example (Validate Pattern Usage):**
```json
{
  "withPatternIds": ["layout-grid", "btn-group"],
  "breakpoint": "desktop"
}
```

**Response Example (200 OK with warnings):**
```json
{
  "passes": false,
  "warnings": [
    {
      "code": "COMPOSITION_CAUTION",
      "patternId": "btn-group",
      "message": "Button group should not override individual button colors.",
      "remediation": "Use token overrides instead of pattern-level color changes."
    }
  ],
  "errors": []
}
```

## Authentication & Authorization

**Bearer Token Authentication** (per P1 pattern):
- Every endpoint requires `Authorization: Bearer <MCP_SECRET>` header
- Token must match the server's `MCP_SECRET` environment variable
- Errors:
  - `MISSING_AUTH_HEADER` — no Authorization header
  - `INVALID_TOKEN` — wrong or empty token
  - `INVALID_AUTH_SCHEME` — not Bearer scheme

## Error Handling

**Unified Error Envelope:**
```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<human-readable description>"
  }
}
```

**Status Codes:**
- `200` — Success
- `201` — Created
- `204` — Deleted (no content)
- `400` — Validation error or business rule violation (e.g., DUPLICATE_PATTERN_ID, INVALID_PATTERN_CATEGORY)
- `401` — Authentication failed
- `404` — Resource not found
- `409` — Conflict (e.g., concurrent edit)

**Common Error Codes:**
- **Pattern:** `PATTERN_NOT_FOUND`, `DUPLICATE_PATTERN_ID`, `PATTERN_IN_USE`, `INVALID_PATTERN_CATEGORY`
- **Composition:** `DUPLICATE_COMPOSITION_RULE`, `COMPOSITION_RULE_NOT_FOUND`
- **Guideline:** `GUIDELINE_NOT_FOUND`, `GUIDELINE_IN_USE`, `INVALID_GUIDELINE_TYPE`
- **Validation:** `INVALID_BREAKPOINT`, `INVALID_COMPOSITION`
- **Auth:** `MISSING_AUTH_HEADER`, `INVALID_TOKEN`, `INVALID_AUTH_SCHEME`

## Data Model: Pattern Categories

Patterns are classified by domain for efficient discovery and filtering:

| Category | Use Case |
|----------|----------|
| **layout** | Grid, flexbox, spacing, alignment patterns |
| **component** | Button, card, modal, form patterns |
| **interaction** | Hover, focus, disabled, loading states |
| **accessibility** | Keyboard nav, focus management, ARIA patterns |
| **animation** | Transitions, motion, microinteractions |
| **spacing** | Margin/padding conventions |
| **color** | Color application, contrast rules |
| **typography** | Font hierarchy, line height, letter spacing |

## Data Model: Responsive Breakpoints

Patterns support responsive variants keyed by breakpoint:

| Breakpoint | Typical Width |
|-----------|---------------|
| **mobile** | 0-479px |
| **tablet** | 480-1023px |
| **desktop** | 1024px+ |
| **wide** | 1440px+ (optional) |

## Features & Capabilities

### Pattern Catalog
- **List patterns** — GET with pagination and optional filtering by category or tag
- **Create pattern** — POST with metadata and optional initial variants
- **Get pattern** — GET with full details (variants, composition rules, related components)
- **Update pattern** — PUT to change name, description, tags, guidance URL
- **Delete pattern** — DELETE (fails if in-use: PATTERN_IN_USE)

### Pattern Variants (Responsive)
- **Add variant** — POST to a pattern with name, description, applies-at breakpoint
- **Delete variant** — DELETE to remove a responsive variant

### Composition Rules
- **List rules** — GET with optional filtering by pattern
- **Create rule** — POST with two patterns and a relation type
- **Get rule** — GET single rule details
- **Update rule** — PUT to change relation or guidance
- **Delete rule** — DELETE a rule

### Layout Guidelines
- **List guidelines** — GET with optional filtering by type
- **Create guideline** — POST with type, name, and flexible JSON data
- **Get guideline** — GET single guideline
- **Update guideline** — PUT to change name, description, or data
- **Delete guideline** — DELETE (fails if referenced: GUIDELINE_IN_USE)

### Pattern Validation
- **Validate usage** — POST `/patterns/{patternId}/validate-usage` to check composition rules
  - Returns warnings and errors
  - Supports optional breakpoint context for variant-aware validation
  - Errors block deployment; warnings are advisory

## Schema Count & Organization

- **21 schemas** — comprehensive type definitions
- **5 tag groups** — Patterns, Pattern Variants, Composition Rules, Layout Guidelines, Pattern Validation
- **Request schemas** — `Create*Input`, `Update*Input` for all mutations
- **Response schemas** — `Pattern`, `CompositionRule`, `LayoutGuideline` for all reads
- **Error schemas** — `ErrorEnvelope`, `AuthErrorEnvelope`, `ErrorDetail`

## Backward Compatibility & Versioning

This contract follows OpenAPI 3.1.0 and is designed for contract-first, parallel development:

- **Frozen marker** at the top: do not edit without lint + breaking-change detection
- **Phase tag** (P2) — endpoints are live in production (no feature flags)
- **Additive-only changes** — always add new fields/endpoints; never remove or rename
- **Error codes** are stable across versions — consumers can rely on `code` for logic, never parse `message`
- **Status codes** are stable — 200, 201, 204, 400, 401, 404, 409 per REST conventions

## Test Coverage & Integration

The contract is ready for:

1. **Unit tests** — mock server using OpenAPI examples
2. **Integration tests** — live API against in-memory SQLite
3. **E2E tests** — Cucumber scenarios validating end-to-end flows
4. **Contract tests** — verify implementation against frozen spec
5. **Backward-compatibility tests** — ensure no breaking changes

Example test scenarios (for E2E engineers):
- Create pattern with variants, list, get, update, delete
- Create composition rules, validate pattern usage
- Create layout guidelines, list by type
- Validate error handling (400, 401, 404, 409)
- Verify pagination (limit, offset)
- Verify auth (missing header, invalid token, missing secret)

## Review Gates (Pre-Shipping Checklist)

Before this contract ships, the following gates MUST pass:

1. **Code-quality review** — OpenAPI structure, schema consistency, examples
2. **Security review** — bearer auth enforcement, no secrets in examples, error details don't leak
3. **API design review** — resource naming, consistency with P1, pagination, filtering

All findings must be folded back into the contract BEFORE implementation begins.

## Handoff to Builders

This frozen contract enables parallel work:

- **Backend developer** — implements the 9 paths and 21 schemas against this contract
- **Test engineer** — writes E2E tests validating the contract behavior
- **Frontend developer** — mocks the API using the examples and builds against it immediately
- **Integration node** — uses the MCP bridge to call the backend endpoints

All builders follow the contract, not vice versa. Changes to the contract require re-freezing (lint + breaking-change detection).
