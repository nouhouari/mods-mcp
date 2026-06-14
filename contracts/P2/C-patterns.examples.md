# C-patterns API — Request/Response Examples

This document provides curl examples and JSON payloads for testing and implementation reference.

## Setup

```bash
export BASE_URL="http://localhost:3100"
export TOKEN="dev"  # Set to your MCP_SECRET
export PROJECT_ID="proj-acme"
```

## Pattern Operations

### 1. Create a Pattern

**Request:**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/patterns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "card-hero",
    "name": "Hero Card",
    "category": "layout",
    "description": "Full-width card with image, title, and CTA button.",
    "tags": ["responsive", "accessibility"],
    "guidanceUrl": "https://design-docs.example.com/patterns/hero-card",
    "variants": [
      {
        "name": "mobile",
        "description": "Stack vertically on small screens.",
        "appliesAt": "mobile"
      },
      {
        "name": "desktop",
        "description": "Side-by-side layout on large screens.",
        "appliesAt": "desktop"
      }
    ]
  }'
```

**Response (201 Created):**
```json
{
  "id": "card-hero",
  "projectId": "proj-acme",
  "name": "Hero Card",
  "category": "layout",
  "description": "Full-width card with image, title, and CTA button.",
  "tags": ["responsive", "accessibility"],
  "guidanceUrl": "https://design-docs.example.com/patterns/hero-card",
  "variants": [
    {
      "id": "variant-mobile",
      "name": "mobile",
      "description": "Stack vertically on small screens.",
      "appliesAt": "mobile",
      "createdAt": "2026-06-14T10:00:00.000Z"
    },
    {
      "id": "variant-desktop",
      "name": "desktop",
      "description": "Side-by-side layout on large screens.",
      "appliesAt": "desktop",
      "createdAt": "2026-06-14T10:00:00.000Z"
    }
  ],
  "relatedComponents": [],
  "compositionRules": [],
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:00.000Z"
}
```

### 2. List Patterns

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/patterns?category=layout&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "patterns": [
    {
      "id": "card-hero",
      "projectId": "proj-acme",
      "name": "Hero Card",
      "category": "layout",
      "description": "Full-width card with image, title, and CTA button.",
      "tags": ["responsive", "accessibility"],
      "guidanceUrl": "https://design-docs.example.com/patterns/hero-card",
      "variants": [
        {"id": "variant-mobile", "name": "mobile", "appliesAt": "mobile", "createdAt": "2026-06-14T10:00:00.000Z"},
        {"id": "variant-desktop", "name": "desktop", "appliesAt": "desktop", "createdAt": "2026-06-14T10:00:00.000Z"}
      ],
      "relatedComponents": [],
      "compositionRules": [],
      "createdAt": "2026-06-14T10:00:00.000Z",
      "updatedAt": "2026-06-14T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### 3. Get a Pattern

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "id": "card-hero",
  "projectId": "proj-acme",
  "name": "Hero Card",
  "category": "layout",
  "description": "Full-width card with image, title, and CTA button.",
  "tags": ["responsive", "accessibility"],
  "guidanceUrl": "https://design-docs.example.com/patterns/hero-card",
  "variants": [
    {"id": "variant-mobile", "name": "mobile", "appliesAt": "mobile", "createdAt": "2026-06-14T10:00:00.000Z"},
    {"id": "variant-desktop", "name": "desktop", "appliesAt": "desktop", "createdAt": "2026-06-14T10:00:00.000Z"}
  ],
  "relatedComponents": ["btn-primary", "card-base"],
  "compositionRules": ["rule-card-inside-grid"],
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:00.000Z"
}
```

### 4. Update a Pattern

**Request:**
```bash
curl -X PUT "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hero Card (Updated)",
    "description": "Full-width card with image, title, CTA button, and optional badge.",
    "tags": ["responsive", "accessibility", "cta", "badge"],
    "guidanceUrl": "https://design-docs.example.com/patterns/hero-card/v2"
  }'
```

**Response (200 OK):**
```json
{
  "id": "card-hero",
  "projectId": "proj-acme",
  "name": "Hero Card (Updated)",
  "category": "layout",
  "description": "Full-width card with image, title, CTA button, and optional badge.",
  "tags": ["responsive", "accessibility", "cta", "badge"],
  "guidanceUrl": "https://design-docs.example.com/patterns/hero-card/v2",
  "variants": [
    {"id": "variant-mobile", "name": "mobile", "appliesAt": "mobile", "createdAt": "2026-06-14T10:00:00.000Z"},
    {"id": "variant-desktop", "name": "desktop", "appliesAt": "desktop", "createdAt": "2026-06-14T10:00:00.000Z"}
  ],
  "relatedComponents": ["btn-primary", "card-base"],
  "compositionRules": ["rule-card-inside-grid"],
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:05:00.000Z"
}
```

### 5. Delete a Pattern

**Request:**
```bash
curl -X DELETE "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
```
(empty body)
```

## Pattern Variant Operations

### 1. Add a Pattern Variant

**Request:**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero/variants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tablet",
    "description": "Optimized layout for tablet (768-1024px).",
    "appliesAt": "tablet"
  }'
```

**Response (201 Created):**
```json
{
  "id": "variant-tablet",
  "name": "tablet",
  "description": "Optimized layout for tablet (768-1024px).",
  "appliesAt": "tablet",
  "createdAt": "2026-06-14T10:15:00.000Z"
}
```

### 2. Delete a Pattern Variant

**Request:**
```bash
curl -X DELETE "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero/variants/variant-tablet" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
```
(empty body)
```

## Composition Rule Operations

### 1. Create a Composition Rule

**Request:**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/composition-rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patternAId": "card-hero",
    "patternBId": "layout-grid",
    "relation": "NESTING_ALLOWED",
    "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline."
  }'
```

**Response (201 Created):**
```json
{
  "id": "rule-card-inside-grid",
  "projectId": "proj-acme",
  "patternAId": "card-hero",
  "patternBId": "layout-grid",
  "relation": "NESTING_ALLOWED",
  "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline.",
  "createdAt": "2026-06-14T10:00:00.000Z"
}
```

### 2. List Composition Rules

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/composition-rules?patternId=card-hero&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "rules": [
    {
      "id": "rule-card-inside-grid",
      "projectId": "proj-acme",
      "patternAId": "card-hero",
      "patternBId": "layout-grid",
      "relation": "NESTING_ALLOWED",
      "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline.",
      "createdAt": "2026-06-14T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### 3. Get a Composition Rule

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/composition-rules/rule-card-inside-grid" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "id": "rule-card-inside-grid",
  "projectId": "proj-acme",
  "patternAId": "card-hero",
  "patternBId": "layout-grid",
  "relation": "NESTING_ALLOWED",
  "guidance": "Hero cards can be placed inside grid layouts; ensure adequate spacing per the layout guideline.",
  "createdAt": "2026-06-14T10:00:00.000Z"
}
```

### 4. Update a Composition Rule

**Request:**
```bash
curl -X PUT "$BASE_URL/api/projects/$PROJECT_ID/composition-rules/rule-card-inside-grid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "relation": "NESTING_ALLOWED",
    "guidance": "Updated: Hero cards can be placed inside grids. Minimum spacing is 16px."
  }'
```

**Response (200 OK):**
```json
{
  "id": "rule-card-inside-grid",
  "projectId": "proj-acme",
  "patternAId": "card-hero",
  "patternBId": "layout-grid",
  "relation": "NESTING_ALLOWED",
  "guidance": "Updated: Hero cards can be placed inside grids. Minimum spacing is 16px.",
  "createdAt": "2026-06-14T10:00:00.000Z"
}
```

### 5. Delete a Composition Rule

**Request:**
```bash
curl -X DELETE "$BASE_URL/api/projects/$PROJECT_ID/composition-rules/rule-card-inside-grid" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
```
(empty body)
```

## Layout Guideline Operations

### 1. Create a Layout Guideline

**Request (Spacing Scale):**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Response (201 Created):**
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
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:00.000Z"
}
```

**Request (Responsive Breakpoints):**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "breakpoints",
    "name": "Responsive Breakpoints",
    "description": "Mobile-first breakpoint scale for responsive design.",
    "data": {
      "mobile": {"min": 0, "max": 479},
      "tablet": {"min": 480, "max": 1023},
      "desktop": {"min": 1024, "max": null}
    }
  }'
```

**Response (201 Created):**
```json
{
  "id": "guideline-breakpoints",
  "projectId": "proj-acme",
  "type": "breakpoints",
  "name": "Responsive Breakpoints",
  "description": "Mobile-first breakpoint scale for responsive design.",
  "data": {
    "mobile": {"min": 0, "max": 479},
    "tablet": {"min": 480, "max": 1023},
    "desktop": {"min": 1024, "max": null}
  },
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:00.000Z"
}
```

### 2. List Layout Guidelines

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines?type=spacing" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "guidelines": [
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
      "createdAt": "2026-06-14T10:00:00.000Z",
      "updatedAt": "2026-06-14T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 3. Get a Layout Guideline

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines/guideline-spacing" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
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
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:00.000Z"
}
```

### 4. Update a Layout Guideline

**Request:**
```bash
curl -X PUT "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines/guideline-spacing" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spacing Scale (v2)",
    "description": "Updated spacing scale with new value for xs.",
    "data": {
      "xs": 2,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32,
      "xxl": 48
    }
  }'
```

**Response (200 OK):**
```json
{
  "id": "guideline-spacing",
  "projectId": "proj-acme",
  "type": "spacing",
  "name": "Spacing Scale (v2)",
  "description": "Updated spacing scale with new value for xs.",
  "data": {
    "xs": 2,
    "sm": 8,
    "md": 16,
    "lg": 24,
    "xl": 32,
    "xxl": 48
  },
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:05:00.000Z"
}
```

### 5. Delete a Layout Guideline

**Request:**
```bash
curl -X DELETE "$BASE_URL/api/projects/$PROJECT_ID/layout-guidelines/guideline-spacing" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204 No Content):**
```
(empty body)
```

## Pattern Validation

### 1. Validate Pattern Usage

**Request:**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero/validate-usage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "withPatternIds": ["layout-grid", "btn-group"],
    "breakpoint": "desktop"
  }'
```

**Response (200 OK — All Good):**
```json
{
  "passes": true,
  "warnings": [],
  "errors": []
}
```

**Response (200 OK — With Warnings):**
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

**Response (200 OK — With Errors):**
```json
{
  "passes": false,
  "warnings": [],
  "errors": [
    {
      "code": "COMPOSITION_FORBIDDEN",
      "patternId": "layout-grid",
      "message": "Hero cards cannot nest inside this grid layout.",
      "remediation": "Use a different grid layout or place the hero card outside."
    }
  ]
}
```

## Error Examples

### 1. Missing Authentication Header

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/patterns"
```

**Response (401 Unauthorized):**
```json
{
  "error": {
    "code": "MISSING_AUTH_HEADER",
    "message": "Authorization header is required."
  }
}
```

### 2. Invalid Token

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/patterns" \
  -H "Authorization: Bearer invalid-token"
```

**Response (401 Unauthorized):**
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided bearer token is invalid."
  }
}
```

### 3. Duplicate Pattern ID

**Request:**
```bash
curl -X POST "$BASE_URL/api/projects/$PROJECT_ID/patterns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"card-hero","name":"Card Hero","category":"layout"}'
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "DUPLICATE_PATTERN_ID",
    "message": "A pattern with id 'card-hero' already exists in project 'proj-acme'."
  }
}
```

### 4. Pattern Not Found

**Request:**
```bash
curl "$BASE_URL/api/projects/$PROJECT_ID/patterns/unknown-pattern" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (404 Not Found):**
```json
{
  "error": {
    "code": "PATTERN_NOT_FOUND",
    "message": "Pattern 'unknown-pattern' not found in project 'proj-acme'."
  }
}
```

### 5. Pattern in Use (Cannot Delete)

**Request:**
```bash
curl -X DELETE "$BASE_URL/api/projects/$PROJECT_ID/patterns/card-hero" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "PATTERN_IN_USE",
    "message": "Cannot delete pattern 'card-hero': 3 composition rules reference it."
  }
}
```

## Testing Checklist

- [ ] Create pattern with variants
- [ ] List patterns with filters (category, tag)
- [ ] Paginate through patterns (limit, offset)
- [ ] Get single pattern
- [ ] Update pattern (metadata only, not variants)
- [ ] Add variant to pattern
- [ ] Delete variant from pattern
- [ ] Create composition rule
- [ ] List rules with filters
- [ ] Get single rule
- [ ] Update rule
- [ ] Delete rule
- [ ] Create layout guideline (test all types: spacing, breakpoints, grid, alignment, typography, animation)
- [ ] List guidelines with filters (type)
- [ ] Get single guideline
- [ ] Update guideline
- [ ] Delete guideline
- [ ] Validate pattern usage (all good)
- [ ] Validate pattern usage (with warnings)
- [ ] Validate pattern usage (with errors)
- [ ] Test 400 error (duplicate ID, invalid category)
- [ ] Test 401 error (missing header, invalid token)
- [ ] Test 404 error (pattern not found, project not found)
- [ ] Test 409 error (conflict scenarios)
