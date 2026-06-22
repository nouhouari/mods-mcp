# MPDS-MCP

Multi-Project Design System MCP Server — an HTTP server that exposes design tokens,
component specs, and validation utilities via a JSON REST API and an MCP JSON-RPC
endpoint. Multiple design-system projects can coexist, each with parent-child
inheritance for token resolution.

## Architecture

```
modules/
  mcp-server/   # Express HTTP server (this binary, port MCP_PORT)
  registry/     # Project CRUD (SQLite-backed)
  tokens/       # Token storage, overrides, semantic resolution
  components/   # Component spec storage and overrides
  patterns/     # Pattern library: patterns, variants, composition rules, layout guidelines
  validate/     # Color-pair + snippet validation
  preview/      # HTML showcase generator (generate_showcase MCP tool)
  db/           # Shared SQLite connection + migrations
```

## Running locally

### Prerequisites

- Node.js 20+ and npm
- A writable directory for the SQLite DB (or use `:memory:` for a transient session)

### Start (development)

```bash
npm ci
MCP_SECRET=dev DB_PATH=/tmp/mpds-dev.db MCP_PORT=3100 \
  npm --prefix modules/mcp-server run dev
```

Health check:

```bash
curl http://localhost:3100/health
# → {"status":"ok"}
```

### Start (production build)

```bash
npm ci
npm --prefix modules/mcp-server run build
MCP_SECRET=<secret> DB_PATH=/home/mpds/data/mpds.db MPDS_ENV=production \
  npm --prefix modules/mcp-server start
```

## Environment variables

| Variable     | Required             | Default       | Description                                      |
|--------------|----------------------|---------------|--------------------------------------------------|
| `MCP_SECRET` | Yes (production)     | `""` (no auth)| Bearer token — every `/api/*` request must carry it |
| `DB_PATH`    | Yes                  | —             | SQLite file path or `:memory:` (transient)        |
| `MCP_PORT`   | No                   | random port   | TCP port the server listens on                    |
| `MPDS_ENV`   | No                   | —             | Set to `production` to enforce `MCP_SECRET` check |
| `HOME`       | No (set by OS/Docker)| —             | Used for allowed DB path prefix validation        |

## API endpoints

All endpoints (except `/health`) require `Authorization: Bearer <MCP_SECRET>`.

Error envelope: `{ "error": { "code": "...", "message": "..." } }`

### Health

```
GET /health
```

### Projects

```
GET    /api/projects
POST   /api/projects           body: { id, name, parentId? }
GET    /api/projects/:id
DELETE /api/projects/:id
```

### Tokens

```
GET    /api/projects/:projectId/tokens
PUT    /api/projects/:projectId/tokens/:key     body: { value, description? }
DELETE /api/projects/:projectId/tokens/:key/override
```

### Components

```
GET    /api/projects/:projectId/components
GET    /api/projects/:projectId/components/:componentId
PUT    /api/projects/:projectId/components/:componentId/override
DELETE /api/projects/:projectId/components/:componentId/override
```

### Validation

```
POST   /api/validate/color-pair     body: { foreground, background }
```

### Patterns

```
GET    /api/projects/:projectId/patterns
POST   /api/projects/:projectId/patterns                       body: { id, name, category, description?, tags?, guidanceUrl? }
GET    /api/projects/:projectId/patterns/:patternId
PATCH  /api/projects/:projectId/patterns/:patternId            body: { name?, description?, tags?, guidanceUrl? }
DELETE /api/projects/:projectId/patterns/:patternId
```

### Pattern variants

```
GET    /api/projects/:projectId/patterns/:patternId/variants
POST   /api/projects/:projectId/patterns/:patternId/variants   body: { name, appliesAt, description? }
GET    /api/projects/:projectId/patterns/:patternId/variants/:variantId
PATCH  /api/projects/:projectId/patterns/:patternId/variants/:variantId
DELETE /api/projects/:projectId/patterns/:patternId/variants/:variantId
```

### Composition rules

```
GET    /api/projects/:projectId/composition-rules
POST   /api/projects/:projectId/composition-rules              body: { patternAId, patternBId, relation, guidance? }
DELETE /api/projects/:projectId/composition-rules/:ruleId
```

`relation` enum: `NESTING_ALLOWED` | `NESTING_FORBIDDEN` | `OVERRIDE_CAUTION` | `SIBLING_ONLY` | `EXCLUSIVE`

### Layout guidelines

```
GET    /api/projects/:projectId/layout-guidelines
POST   /api/projects/:projectId/layout-guidelines              body: { type, name, description?, data }
GET    /api/projects/:projectId/layout-guidelines/:guidelineId
PATCH  /api/projects/:projectId/layout-guidelines/:guidelineId
DELETE /api/projects/:projectId/layout-guidelines/:guidelineId
```

`type` enum: `breakpoints` | `spacing` | `grid` | `alignment` | `typography` | `animation`

See [`contracts/P1/`](contracts/P1/) and [`contracts/P2/`](contracts/P2/) for the full frozen OpenAPI specs.

## MCP configuration

The server exposes a JSON-RPC 2.0 endpoint at `POST /mcp` (requires the same `Authorization: Bearer <MCP_SECRET>` header as the REST API). Configure it in your MCP client as an HTTP server.

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "mpds": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3100/mcp"],
      "env": {
        "MCP_REMOTE_HEADER_AUTHORIZATION": "Bearer <MCP_SECRET>"
      }
    }
  }
}
```

### Claude Code (`.claude/settings.json` in your project)

```json
{
  "mcpServers": {
    "mpds": {
      "type": "http",
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_SECRET>"
      }
    }
  }
}
```

### GitHub Copilot (`.vscode/mcp.json` in your workspace)

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "mpds_secret",
      "description": "MPDS MCP bearer token",
      "password": true
    }
  ],
  "servers": {
    "mpds": {
      "type": "http",
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer ${input:mpds_secret}"
      }
    }
  }
}
```

The `input` block causes VS Code to prompt for the secret once per session and store it in the system keychain. To skip the prompt, replace `${input:mpds_secret}` with the token literal (not recommended for shared workspaces).

### OpenCode (`opencode.json` in your project root, or `~/.config/opencode/opencode.json` globally)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mpds": {
      "type": "remote",
      "url": "http://localhost:3100/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer <MCP_SECRET>"
      }
    }
  }
}
```

To avoid hard-coding the secret, reference an environment variable using OpenCode's `{env:VAR}` interpolation:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mpds": {
      "type": "remote",
      "url": "http://localhost:3100/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer {env:MCP_SECRET}"
      }
    }
  }
}
```

### Available MCP methods

#### Read & validate

| Method | Description | Required params |
|---|---|---|
| `list_projects` | List all design-system projects | — |
| `get_tokens` | Resolve tokens for a project (with inheritance) | `projectId`, `category?` |
| `get_design_system` | Full token map + component specs | `projectId` |
| `get_component_spec` | Single component spec | `projectId`, `componentId` |
| `validate_color_pair` | WCAG contrast ratio | `fg`, `bg`, `context` (`normal`\|`large`\|`ui`) |
| `validate_token_pair` | Contrast check using token keys | `projectId`, `fgKey`, `bgKey`, `context` |
| `validate_snippet` | Lint HTML/JSX for a11y issues | `content`, `contentType?` (`html`\|`jsx`) |
| `create_guideline` | Create a design guideline | `id`, `title`, `body?`, `tags?` |
| `search_guidelines` | Full-text search guidelines | `query` |
| `propose_token_override` | Propose a token value change for review | `projectId`, `tokenKey`, `proposedValue`, `rationale?`, `agentId?` |
| `list_proposals` | List pending token proposals | `projectId` |

#### Write — projects & tokens

| Method | Description | Required params |
|---|---|---|
| `create_project` | Create a project | `id`, `name`, `parentId?` |
| `update_project` | Rename a project | `projectId`, `name` |
| `delete_project` | Delete a project | `projectId` |
| `list_tokens` | List all tokens for a project | `projectId`, `category?` |
| `get_token` | Get a single token | `projectId`, `key` |
| `create_token` | Create a token | `projectId`, `key`, `category`, `value`, `isSemantic?`, `semanticRef?` |
| `update_token` | Update a token value (OCC) | `projectId`, `key`, `version`, `value?`, `semanticRef?` |
| `set_token` | Set/override a token value | `projectId`, `key`, `value`, `version` |
| `delete_token` | Delete a token (OCC) | `projectId`, `key`, `version` |
| `delete_token_override` | Remove a child project override | `projectId`, `key` |

#### Write — components

| Method | Description | Required params |
|---|---|---|
| `create_component` | Create a component spec | `projectId`, `id`, `name`, `description?`, `props?`, `variants?`, `states?`, … |
| `update_component` | Update a component spec (OCC) | `projectId`, `componentId`, `version`, `name?`, `description?`, … |
| `delete_component` | Delete a component spec | `projectId`, `componentId` |

#### Write — pattern library

| Method | Description | Required params |
|---|---|---|
| `create_pattern` | Create a pattern | `projectId`, `id`, `name`, `category`, `description?`, `tags?` |
| `update_pattern` | Update a pattern | `projectId`, `patternId`, `name?`, `description?`, `tags?` |
| `delete_pattern` | Delete a pattern | `projectId`, `patternId` |
| `create_variant` | Add a variant to a pattern | `projectId`, `patternId`, `name`, `appliesAt`, `description?` |
| `update_variant` | Update a variant | `projectId`, `patternId`, `variantId`, `name?`, `appliesAt?` |
| `delete_variant` | Delete a variant | `projectId`, `patternId`, `variantId` |
| `create_composition_rule` | Define a pattern relationship | `projectId`, `patternAId`, `patternBId`, `relation`, `guidance?` |
| `delete_composition_rule` | Remove a composition rule | `projectId`, `ruleId` |
| `create_layout_guideline` | Create a layout guideline | `projectId`, `type`, `name`, `description?`, `data` |
| `update_layout_guideline` | Update a layout guideline | `projectId`, `guidelineId`, `name?`, `description?`, `data?` |
| `delete_layout_guideline` | Delete a layout guideline | `projectId`, `guidelineId` |

#### Showcase

| Method | Description | Required params |
|---|---|---|
| `generate_showcase` | Generate a self-contained HTML design system preview (color palette, component gallery, pattern library) | `projectId`, `title?` |

```bash
# Save and open the showcase locally
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <MCP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds"}}' \
  | jq -r '.result.html' > /tmp/showcase.html && open /tmp/showcase.html
```

All requests follow JSON-RPC 2.0:

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer <MCP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"list_projects","params":{}}' | jq
```

## Running tests

Tests use an in-memory SQLite database and require no external services:

```bash
DB_PATH=:memory: MCP_SECRET=test npm test
```

## Docker

```bash
docker build -t mpds-mcp .
docker run -p 3100:3100 \
  -e MCP_SECRET=<secret> \
  -e DB_PATH=/home/mpds/data/mpds.db \
  -v $(pwd)/data:/home/mpds/data \
  mpds-mcp
```

See [`INSTALL.md`](INSTALL.md) for full setup and docker-compose instructions.
