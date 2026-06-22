# C-mcp-showcase Usage Examples — Phase 4

All examples assume the server is running on `localhost:3100` with `MCP_SECRET=mysecret`.

---

## 1. Basic call (projectId only)

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds"}}' \
  | jq
```

**Expected response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "html": "<!DOCTYPE html><html lang=\"en\">...</html>",
    "tokenCount": 42,
    "componentCount": 8,
    "patternCount": 5
  }
}
```

---

## 2. Call with custom page title

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"generate_showcase","params":{"projectId":"my-ds","title":"Acme Design System"}}' \
  | jq
```

---

## 3. Save the HTML to disk and open in browser

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds","title":"Acme Design System"}}' \
  | jq -r '.result.html' > /tmp/showcase.html && open /tmp/showcase.html
```

On Linux, replace `open` with `xdg-open`:

```bash
  | jq -r '.result.html' > /tmp/showcase.html && xdg-open /tmp/showcase.html
```

---

## 4. Log the summary counts without extracting HTML

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds"}}' \
  | jq '{ tokenCount: .result.tokenCount, componentCount: .result.componentCount, patternCount: .result.patternCount }'
```

**Expected output:**

```json
{
  "tokenCount": 42,
  "componentCount": 8,
  "patternCount": 5
}
```

---

## 5. Save to a timestamped file

```bash
TS=$(date +%Y%m%d-%H%M%S)
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"generate_showcase\",\"params\":{\"projectId\":\"my-ds\",\"title\":\"Acme Design System\"}}" \
  | jq -r '.result.html' > "/tmp/showcase-${TS}.html"
echo "Saved to /tmp/showcase-${TS}.html"
```

---

## 6. Error — project not found

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"does-not-exist"}}' \
  | jq
```

**Expected response (HTTP 200, JSON-RPC error):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "code": "PROJECT_NOT_FOUND",
      "message": "Project 'does-not-exist' was not found."
    }
  }
}
```

---

## 7. Error — missing projectId

```bash
curl -s http://localhost:3100/mcp \
  -H "Authorization: Bearer mysecret" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{}}' \
  | jq
```

**Expected response (HTTP 200, JSON-RPC error):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: projectId is required"
  }
}
```

---

## 8. Error — authentication failure

```bash
curl -s http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds"}}' \
  | jq
```

**Expected response (HTTP 401):**

```json
{
  "error": {
    "code": "MISSING_AUTH_HEADER",
    "message": "Authorization header is required."
  }
}
```

---

## Mock server (frontend development before backend is ready)

Start a Prism mock server from the spec:

```bash
npx @stoplight/prism-cli mock contracts/P4/C-mcp-showcase.openapi.yaml --port 4010
```

Then call the mock using the named example:

```bash
curl -s http://localhost:4010/mcp \
  -H "Authorization: Bearer any" \
  -H "Content-Type: application/json" \
  -H "Prefer: example=generate_showcase_result" \
  -d '{"jsonrpc":"2.0","id":1,"method":"generate_showcase","params":{"projectId":"my-ds"}}' \
  | jq
```

The mock returns the `generate_showcase_result` example from the spec, allowing
the frontend/agent to build against the contract before the backend implements it.
