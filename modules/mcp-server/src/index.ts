import * as http from 'http';
import { listProjects, getProject, RegistryError } from '../../registry/index';
import { resolveTokens, TokensError } from '../../tokens/index';
import { listSpecs, getSpec, ComponentsError } from '../../components/index';
import { getDb, runMigrations } from '../../db/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Auth middleware helper
// ---------------------------------------------------------------------------

function checkAuth(
  req: http.IncomingMessage,
  secret: string
): { ok: true } | { ok: false; code: string; message: string } {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return { ok: false, code: 'MISSING_AUTH_HEADER', message: 'Authorization header is required' };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, code: 'INVALID_AUTH_SCHEME', message: 'Authorization header must use Bearer scheme' };
  }
  const token = authHeader.slice('Bearer '.length);
  if (token !== secret) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Invalid bearer token' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  const len = Buffer.byteLength(payload, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': len,
  });
  res.end(payload);
}

function sendAuthError(res: http.ServerResponse, code: string, message: string): void {
  sendJson(res, 401, { error: { code, message } });
}

// ---------------------------------------------------------------------------
// Body reader
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC dispatcher
// ---------------------------------------------------------------------------

async function dispatchMcp(
  rpc: JsonRpcRequest
): Promise<{ result?: unknown; error?: { code: string; message: string } }> {
  const params = (rpc.params ?? {}) as Record<string, unknown>;

  try {
    switch (rpc.method) {
      case 'get_tokens': {
        const projectId = params['projectId'] as string;
        const category = params['category'] as string | undefined;
        const tokens = await resolveTokens(projectId, category);
        return { result: tokens };
      }

      case 'get_design_system': {
        const projectId = params['projectId'] as string;
        // Validate project exists (throws RegistryError if not found)
        await getProject(projectId);
        const [resolved, components] = await Promise.all([
          resolveTokens(projectId),
          listSpecs(projectId),
        ]);
        // Build token map keyed by token key
        const tokenMap: Record<string, { value: string; category: string; source: string }> = {};
        for (const t of resolved) {
          tokenMap[t.key] = { value: t.value, category: t.category, source: t.source };
        }
        return { result: { tokens: tokenMap, components } };
      }

      case 'get_component_spec': {
        const projectId = params['projectId'] as string;
        const componentId = params['componentId'] as string;
        const spec = await getSpec(projectId, componentId);
        return { result: spec };
      }

      default:
        return {
          error: { code: 'METHOD_NOT_FOUND', message: `Unknown method: ${rpc.method}` },
        };
    }
  } catch (err: unknown) {
    if (
      err instanceof RegistryError ||
      err instanceof TokensError ||
      err instanceof ComponentsError
    ) {
      return {
        error: {
          code: (err as RegistryError).code,
          message: (err as Error).message,
        },
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Request handler factory
// ---------------------------------------------------------------------------

function createHandler(secret: string) {
  return async function handler(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const urlStr = req.url ?? '/';
    const method = req.method ?? 'GET';

    // GET /health — unauthenticated liveness probe
    if (method === 'GET' && urlStr === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    // Auth check for all other routes
    const authResult = checkAuth(req, secret);
    if (!authResult.ok) {
      sendAuthError(res, authResult.code, authResult.message);
      return;
    }

    // GET /api/projects — list all projects
    if (method === 'GET' && urlStr === '/api/projects') {
      const projects = await listProjects();
      sendJson(res, 200, projects);
      return;
    }

    // POST /mcp — JSON-RPC 2.0 dispatcher
    if (method === 'POST' && urlStr === '/mcp') {
      let rpc: JsonRpcRequest;
      try {
        const raw = await readBody(req);
        rpc = JSON.parse(raw) as JsonRpcRequest;
      } catch {
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id: null,
          error: { code: 'PARSE_ERROR', message: 'Invalid JSON body' },
        });
        return;
      }

      const { result, error } = await dispatchMcp(rpc);
      if (error) {
        sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, error });
      } else {
        sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result });
      }
      return;
    }

    // 404 for any other path
    sendJson(res, 404, {
      error: { code: 'NOT_FOUND', message: `${method} ${urlStr} not found` },
    });
  };
}

// ---------------------------------------------------------------------------
// startServer — exported for programmatic use and called from CLI entry point
// ---------------------------------------------------------------------------

export async function startServer(opts?: {
  port?: number;
  secret?: string;
}): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
  const secret = opts?.secret ?? process.env['MCP_SECRET'] ?? '';
  const requestedPort = opts?.port ?? Number(process.env['MCP_PORT'] ?? 0);

  // Apply migrations against the DB at DB_PATH before accepting any requests.
  // When spawned by mcp-server.hooks.ts, DB_PATH is already set to the
  // scenario's temp file by world.ts Before hook (which runs before this one
  // due to registration order).
  const db = getDb();
  runMigrations(db);

  const handler = createHandler(secret);
  const server = http.createServer((req, res) => {
    handler(req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(requestedPort, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const addr = server.address() as { port: number };
  const port = addr.port;

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { server, port, close };
}

// ---------------------------------------------------------------------------
// CLI entry point — spawned by mcp-server.hooks.ts via node + ts-node
// ---------------------------------------------------------------------------

if (require.main === module) {
  startServer()
    .then(({ port }) => {
      process.stdout.write(`MCP server listening on port ${port}\n`);
    })
    .catch((err: unknown) => {
      process.stderr.write(`Failed to start MCP server: ${err}\n`);
      process.exit(1);
    });
}
