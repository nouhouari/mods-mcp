# MCP Server Transport (C-mcp)

HTTP transport layer for the MPDS design system management API. Exposes design system data (tokens, component specs, design system registry) via a stateless HTTP server that implements both a REST API for direct consumption and a JSON-RPC 2.0 endpoint for MCP tool integrations.

## What it does

- **HTTP Server**: Express-compatible HTTP server listening on `MCP_PORT` (default 3100)
- **Authentication**: Bearer token scheme via `Authorization: Bearer <MCP_SECRET>` header (required for all endpoints except `/health`)
- **JSON-RPC 2.0 Endpoint**: `POST /mcp` for MCP tool dispatch
- **REST API**: Projects, tokens, components, and validation endpoints
- **Error Handling**: Consistent error envelope with error codes and user-friendly messages

## Prerequisites

- Node.js 18 or later
- npm 9 or later

## Local Development

### Installation

```bash
cd /path/to/snapbooks/modules/mcp-server
npm install
```

### Environment Variables

| Variable      | Default | Required | Purpose |
|---------------|---------|----------|---------|
| `MCP_PORT`    | 3100    | No       | HTTP server port |
| `MCP_SECRET`  | (empty) | No*      | Bearer token for auth; set in production |
| `MPDS_ENV`    | dev     | No       | Set to `production` to enforce `MCP_SECRET` |

*In production (`MPDS_ENV=production`), `MCP_SECRET` is mandatory.

### Start the Server

**Development** (with hot-reload via tsx):
```bash
npm run dev
```

**Production** (compiled Node):
```bash
npm run build
npm start
```

Output will show:
```
MPDS-MCP listening on port 3100 [auth: disabled]
```

### Health Check

```bash
curl http://localhost:3100/health
```

Response (no auth required):
```json
{"status":"ok"}
```

## REST API Endpoints

All endpoints except `/health` require `Authorization: Bearer <token>` header.

### Projects

#### List projects
```bash
curl -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects
```

Response (200 OK):
```json
[
  {
    "id": "design-system-v1",
    "name": "Design System v1",
    "parentId": null
  }
]
```

#### Get project details
```bash
curl -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects/design-system-v1
```

Response (200 OK):
```json
{
  "id": "design-system-v1",
  "name": "Design System v1",
  "parentId": null
}
```

#### Create project
```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"id":"new-ds","name":"New Design System"}' \
  http://localhost:3100/api/projects
```

Response (201 Created):
```json
{
  "id": "new-ds",
  "name": "New Design System",
  "parentId": null
}
```

#### Delete project
```bash
curl -X DELETE \
  -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects/design-system-v1
```

Response (204 No Content)

### Tokens

#### List resolved tokens (with optional category filter)
```bash
curl -H "Authorization: Bearer $MCP_SECRET" \
  "http://localhost:3100/api/projects/design-system-v1/tokens?category=color"
```

Response (200 OK):
```json
[
  {
    "key": "color.primary",
    "value": "#0066cc",
    "category": "color",
    "source": "base"
  },
  {
    "key": "color.primary-dark",
    "value": "#003d99",
    "category": "color",
    "source": "override"
  }
]
```

Available categories: `color`, `spacing`, `typography`, `border`, `shadow`, etc.

#### Update token override
```bash
curl -X PUT \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -H "If-Match: 1" \
  -d '{"value":"#ff0000","version":1}' \
  http://localhost:3100/api/projects/design-system-v1/tokens/color.primary
```

Response (200 OK):
```json
{
  "key": "color.primary",
  "value": "#ff0000",
  "version": 2,
  "override": true
}
```

Uses optimistic concurrency control (OCC) via `If-Match` header (expected version). Fails with 409 Conflict if version mismatch.

#### Delete token override
```bash
curl -X DELETE \
  -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects/design-system-v1/tokens/color.primary/override
```

Response (204 No Content)

### Components

#### List component specs
```bash
curl -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects/design-system-v1/components
```

Response (200 OK):
```json
[
  {
    "id": "button",
    "name": "Button",
    "variants": ["primary", "secondary"],
    "resolved": true
  }
]
```

#### Get component spec
```bash
curl -H "Authorization: Bearer $MCP_SECRET" \
  http://localhost:3100/api/projects/design-system-v1/components/button
```

Response (200 OK):
```json
{
  "id": "button",
  "name": "Button",
  "description": "Primary action button",
  "variants": {
    "primary": {
      "background": "color.primary",
      "text": "color.text-inverse"
    },
    "secondary": {
      "background": "color.neutral-100",
      "text": "color.text-dark"
    }
  },
  "resolved": true
}
```

### Validation

#### Validate color pair (WCAG contrast)
```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"fg":"#000000","bg":"#ffffff","context":"normal"}' \
  http://localhost:3100/api/validate/color-pair
```

Response (200 OK):
```json
{
  "aa": true,
  "aaa": true,
  "ratio": 21.0,
  "context": "normal"
}
```

`context` must be one of: `normal`, `large`, or `ui`.

## JSON-RPC 2.0 MCP Tools

The `/mcp` endpoint accepts JSON-RPC 2.0 requests and dispatches to MCP tool implementations.

### list_projects

List all projects.

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"list_projects",
    "params":{}
  }' \
  http://localhost:3100/mcp
```

Response:
```json
{
  "jsonrpc":"2.0",
  "id":1,
  "result":[
    {"id":"design-system-v1","name":"Design System v1"}
  ]
}
```

### get_tokens

Resolve all tokens for a project (optionally filtered by category).

**Parameters:**
- `projectId` (string, required): Project ID
- `category` (string, optional): Filter by category (e.g., "color", "spacing")

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"get_tokens",
    "params":{"projectId":"design-system-v1","category":"color"}
  }' \
  http://localhost:3100/mcp
```

Response:
```json
{
  "jsonrpc":"2.0",
  "id":2,
  "result":[
    {"key":"color.primary","value":"#0066cc","category":"color","source":"base"}
  ]
}
```

### get_design_system

Get complete design system for a project (tokens + component specs).

**Parameters:**
- `projectId` (string, required): Project ID

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"get_design_system",
    "params":{"projectId":"design-system-v1"}
  }' \
  http://localhost:3100/mcp
```

Response:
```json
{
  "jsonrpc":"2.0",
  "id":3,
  "result":{
    "tokens":{
      "color.primary":{"value":"#0066cc","category":"color","source":"base"}
    },
    "components":[
      {"id":"button","name":"Button","variants":["primary","secondary"]}
    ]
  }
}
```

### get_component_spec

Get a specific component spec with resolved references.

**Parameters:**
- `projectId` (string, required): Project ID
- `componentId` (string, required): Component ID

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"get_component_spec",
    "params":{"projectId":"design-system-v1","componentId":"button"}
  }' \
  http://localhost:3100/mcp
```

### validate_color_pair

Validate WCAG contrast ratio for a color pair.

**Parameters:**
- `fg` (string, required): Foreground color (#RGB, #RRGGBB, or rgb(R,G,B))
- `bg` (string, required): Background color (same formats)
- `context` (string, required): One of "normal", "large", or "ui"

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":5,
    "method":"validate_color_pair",
    "params":{"fg":"#000000","bg":"#ffffff","context":"normal"}
  }' \
  http://localhost:3100/mcp
```

### validate_token_pair

Validate WCAG contrast ratio using resolved token values.

**Parameters:**
- `projectId` (string, required): Project ID
- `fgKey` (string, required): Foreground token key (e.g., "color.primary")
- `bgKey` (string, required): Background token key
- `context` (string, required): One of "normal", "large", or "ui"

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":6,
    "method":"validate_token_pair",
    "params":{"projectId":"design-system-v1","fgKey":"color.primary","bgKey":"color.bg","context":"normal"}
  }' \
  http://localhost:3100/mcp
```

### validate_snippet

Validate HTML or JSX snippet for accessibility issues.

**Parameters:**
- `content` (string, required): HTML or JSX code
- `contentType` (string, optional): "html" or "jsx" (default: "html")

```bash
curl -X POST \
  -H "Authorization: Bearer $MCP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":7,
    "method":"validate_snippet",
    "params":{"content":"<button>Click me</button>","contentType":"html"}
  }' \
  http://localhost:3100/mcp
```

## Error Handling

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID 'unknown' not found"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `MISSING_AUTH_HEADER` | 401 | Authorization header is missing |
| `INVALID_AUTH_SCHEME` | 401 | Auth scheme is not Bearer |
| `INVALID_TOKEN` | 401 | Bearer token is empty or invalid |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `COMPONENT_NOT_FOUND` | 404 | Component does not exist |
| `TOKEN_NOT_FOUND` | 404 | Token key does not exist |
| `DUPLICATE_PROJECT_ID` | 409 | Project ID already exists |
| `CONFLICT` | 409 | Optimistic concurrency control conflict (version mismatch) |
| `INVALID_COLOR_FORMAT` | 400 | Color format invalid (must be #RGB, #RRGGBB, or rgb(R,G,B)) |
| `INVALID_CONTEXT` | 400 | Context must be "normal", "large", or "ui" |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

For JSON-RPC endpoints, the HTTP response is always 200 OK; the error code is in the JSON response body.

## Related User Stories

- **US-040**: HTTP server + Bearer auth + `list_projects` REST endpoint
- **US-015**: MCP tool `get_tokens(projectId, category?)` with token resolution
- **US-024**: MCP tool `get_design_system(projectId)` → design system export (tokens + components)
- **US-025**: MCP tool `get_component_spec(projectId, componentId)` with reference resolution

## Architecture

The MCP server is the HTTP gateway to the design system registry. It:

1. Routes HTTP requests to REST and JSON-RPC handlers
2. Enforces authentication on data endpoints
3. Delegates business logic to registry, tokens, components, and validation modules
4. Maintains a shared SQLite database for persistent storage
5. Manages schema migrations on startup

All stateful operations are atomic and thread-safe.
