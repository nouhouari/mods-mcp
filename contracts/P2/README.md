# C-patterns Phase 2 Contract Deliverables

## Overview

This directory contains the complete, frozen OpenAPI 3.1.0 contract for **C-patterns** — the Pattern Management module for MPDS-MCP Phase 2.

**Status:** FROZEN (do not edit without lint + breaking-change detection)  
**Date Frozen:** 2026-06-14  
**Phase:** P2 (ships after P1 MVP)  

## Files in This Directory

| File | Purpose |
|------|---------|
| `C-patterns.openapi.yaml` | Complete OpenAPI 3.1.0 specification (1414 lines, 47KB) |
| `C-patterns.contract-summary.md` | Executive summary, concepts, error handling, and handoff guidance |
| `C-patterns.examples.md` | Curl examples and JSON payloads for every operation |
| `README.md` | This file |

## What's in the Contract

### API Surface: 9 Endpoints
- Pattern catalog (CRUD)
- Pattern variants (create, delete)
- Composition rules (CRUD)
- Layout guidelines (CRUD)
- Pattern validation (POST)

### Data Model: 21 Schemas
- Pattern (with variants, related components, composition rules)
- Composition rules (5 relation types: NESTING_ALLOWED, NESTING_FORBIDDEN, OVERRIDE_CAUTION, SIBLING_ONLY, EXCLUSIVE)
- Layout guidelines (6 types: breakpoints, spacing, grid, alignment, typography, animation)
- Pattern validation (warnings and errors with remediations)
- Error envelopes (unified error model from P1)

### Authentication & Security
- Bearer token authentication (per P1 pattern)
- Consistent error codes and messages
- No secrets in examples
- Clear auth error responses

### Worked Examples
- Full curl commands for every operation
- Real JSON request/response payloads
- Error scenarios (401, 400, 404, 409)
- Testing checklist with 25 test cases

## Ready For

1. **Backend Developer** — Implement the 9 paths and 21 schemas
2. **Test Engineer** — Write E2E tests using the examples
3. **Frontend Developer** — Mock the API immediately using OpenAPI examples
4. **Code Reviewer** — Review against OpenAPI structure, examples, consistency
5. **Security Reviewer** — Review auth, error handling, no information leakage

## Key Design Decisions

### 1. Patterns are Project-Scoped
Like tokens and components, patterns inherit from parent projects. This enables reusable design systems with project-level overrides.

### 2. Composition Rules are First-Class Resources
Rather than embedding constraints in patterns, composition rules are separate CRUD resources. This allows complex pattern interactions to be documented and queried independently.

### 3. Layout Guidelines are Flexible JSON
Guidelines support arbitrary JSON data (breakpoints, spacing, grid, alignment, typography, animation). This allows teams to define custom layout rules without schema changes.

### 4. Pattern Validation is a POST Endpoint
Validation is a read-only POST to `/patterns/{patternId}/validate-usage`, returning warnings and errors. This enables IDE/CI integration without modifying patterns.

### 5. Responsive Breakpoints are Top-Level Variants
Patterns support named variants (mobile, tablet, desktop, wide) at the pattern level, allowing different implementations for different breakpoints.

## Status Codes & Error Handling

- **200 OK** — GET successful
- **201 Created** — POST successful
- **204 No Content** — DELETE successful
- **400 Bad Request** — validation error, business rule violation (DUPLICATE_PATTERN_ID, INVALID_PATTERN_CATEGORY, etc.)
- **401 Unauthorized** — auth failed (MISSING_AUTH_HEADER, INVALID_TOKEN)
- **404 Not Found** — resource not found (PATTERN_NOT_FOUND, PROJECT_NOT_FOUND)
- **409 Conflict** — concurrent edit or state conflict

All errors follow the unified envelope:
```json
{
  "error": {
    "code": "<STABLE_CODE>",
    "message": "<human-readable>"
  }
}
```

## Backward Compatibility

This contract is **frozen at 3.1.0**. Changes after release:
- Always **additive** — never remove or rename fields/paths
- Add new optional fields to existing schemas
- Add new endpoints (never remove)
- Error codes are stable across versions — use `code` for logic, never parse `message`

## Testing & Validation

The contract is valid OpenAPI 3.1.0 YAML and includes:
- Examples for every success path (200, 201, 204)
- Examples for every error path (400, 401, 404, 409)
- Request/response schemas with required fields
- Parameter definitions with defaults and examples
- Security scheme definition (Bearer token)
- Pagination support (limit, offset)
- Filtering support (category, tag, type)

## Integration with MPDS-MCP

This contract extends P1 (C-mcp) with pattern management. It uses:
- Same authentication (Bearer token, MCP_SECRET)
- Same error envelope format
- Same server port (3100)
- Same base URL pattern (`/api/projects/{projectId}/...`)
- Same OpenAPI 3.1.0 structure

## Next Steps

1. **Code-Quality Review** — Review OpenAPI structure, schema consistency, examples
2. **Security Review** — Auth enforcement, error details, no secrets leaked
3. **Backend Implementation** — Implement against the frozen contract
4. **E2E Testing** — Write Cucumber scenarios using the examples
5. **Integration Testing** — Test against live API in in-memory SQLite
6. **Contract Tests** — Validate implementation matches spec

All findings from reviews must be folded back into the contract BEFORE builders start. The contract is the source of truth.

## Questions & Clarifications

If you have questions about the contract:
1. Check `C-patterns.contract-summary.md` for concepts and design decisions
2. Check `C-patterns.examples.md` for worked examples of every operation
3. Review `C-patterns.openapi.yaml` directly for detailed specifications

This contract was designed for contract-first development: backend and frontend can start in parallel immediately after review gates pass.
