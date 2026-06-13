import * as crypto from 'crypto';
import * as http from 'http';
import {
  listProjects,
  getProject,
  createProject,
  deleteProject,
  RegistryError,
} from '../../registry/index';
import {
  resolveTokens,
  deleteOverride as deleteTokenOverride,
  TokensError,
} from '../../tokens/index';
import {
  listSpecs,
  getSpec,
  ComponentsError,
} from '../../components/index';
import {
  validateColorPair,
  validateSnippet,
  ValidateError,
  COLOR_FORMAT_RE,
} from '../../validate/index';
import { getDb, runMigrations } from '../../db/index';

// ---------------------------------------------------------------------------
// Lazy DB / migration initialization
// ---------------------------------------------------------------------------

let _migrationsApplied = false;

function ensureMigrations(): void {
  if (_migrationsApplied) return;
  _migrationsApplied = true;
  const db = getDb();
  runMigrations(db);
  // Ensure proposals table (added post-migrations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id         TEXT NOT NULL PRIMARY KEY,
      project_id TEXT,
      type       TEXT NOT NULL DEFAULT 'token',
      payload    TEXT NOT NULL DEFAULT '{}',
      status     TEXT NOT NULL DEFAULT 'pending',
      note       TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

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
// Auth
// ---------------------------------------------------------------------------

function checkAuth(
  req: http.IncomingMessage,
  secret: string
): { ok: true } | { ok: false; code: string; message: string } {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return { ok: false, code: 'MISSING_AUTH_HEADER', message: 'Authorization header is required' };
  }
  // Accept 'Bearer <token>' or 'Bearer' (empty token from some clients that strip trailing space).
  // Any other scheme (Basic, Digest, etc.) is INVALID_AUTH_SCHEME.
  if (!authHeader.startsWith('Bearer')) {
    return { ok: false, code: 'INVALID_AUTH_SCHEME', message: 'Authorization header must use Bearer scheme' };
  }
  // Extract token: everything after 'Bearer ' (7 chars) or '' when header is exactly 'Bearer'.
  const token = authHeader.length > 7 ? authHeader.slice(7) : '';
  if (!token || token.trim() === '') {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Bearer token is empty' };
  }
  if (secret) {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      return { ok: false, code: 'INVALID_TOKEN', message: 'Invalid bearer token' };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  const len = Buffer.byteLength(payload, 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': len });
  res.end(payload);
}

function sendError(res: http.ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Error code to HTTP status
// ---------------------------------------------------------------------------

function codeToStatus(code: string): number {
  switch (code) {
    case 'PROJECT_NOT_FOUND':
    case 'COMPONENT_NOT_FOUND':
    case 'TOKEN_NOT_FOUND':
    case 'PROPOSAL_NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'DUPLICATE_PROJECT_ID':
    case 'DUPLICATE_COMPONENT_ID':
      return 409;
    default:
      return 400;
  }
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
      case 'list_projects': {
        const projects = await listProjects();
        return { result: projects };
      }

      case 'get_tokens': {
        const projectId = params['projectId'] as string;
        const category = params['category'] as string | undefined;
        // Validate project exists — throws if not found
        await getProject(projectId);
        const tokens = await resolveTokens(projectId, category);
        return { result: tokens };
      }

      case 'get_design_system': {
        const projectId = params['projectId'] as string;
        await getProject(projectId);
        const [resolved, components] = await Promise.all([
          resolveTokens(projectId),
          listSpecs(projectId),
        ]);
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

      case 'validate_color_pair': {
        const { fg, bg, context } = params as { fg: string; bg: string; context: string };
        const result = validateColorPair(fg, bg, context as 'normal' | 'large' | 'ui');
        return { result };
      }

      case 'validate_token_pair': {
        const { projectId, fgKey, bgKey, context } = params as {
          projectId: string;
          fgKey: string;
          bgKey: string;
          context: string;
        };
        await getProject(projectId);
        const allTokens = await resolveTokens(projectId);
        const fgToken = allTokens.find((t) => t.key === fgKey);
        const bgToken = allTokens.find((t) => t.key === bgKey);
        if (!fgToken || !bgToken) {
          return { error: { code: 'TOKEN_NOT_FOUND', message: 'One or more token keys not found' } };
        }
        const result = validateColorPair(
          fgToken.value,
          bgToken.value,
          context as 'normal' | 'large' | 'ui'
        );
        return {
          result: { ...result, resolvedFg: fgToken.value, resolvedBg: bgToken.value },
        };
      }

      case 'validate_snippet': {
        const { content, contentType } = params as { content: string; contentType?: 'html' | 'jsx' };
        const report = validateSnippet({ content, contentType: contentType ?? 'html' });
        return { result: report };
      }

      default:
        return {
          error: { code: 'METHOD_NOT_FOUND', message: 'Unknown method: ' + rpc.method },
        };
    }
  } catch (err: unknown) {
    if (
      err instanceof RegistryError ||
      err instanceof TokensError ||
      err instanceof ComponentsError ||
      err instanceof ValidateError
    ) {
      return {
        error: {
          code: (err as RegistryError & { code: string }).code,
          message: (err as Error).message,
        },
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function createHandler(secret: string) {
  return async function handler(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Strip query string for routing
    const urlStr = (req.url ?? '/').split('?')[0];
    const rawUrl = req.url ?? '/';
    const method = req.method ?? 'GET';

    // GET /health — no auth required
    if (method === 'GET' && urlStr === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    // Auth gate for all other routes
    const authResult = checkAuth(req, secret);
    if (!authResult.ok) {
      sendError(res, 401, authResult.code, authResult.message);
      return;
    }

    // Ensure DB schema before first data access
    ensureMigrations();

    // -----------------------------------------------------------------------
    // Projects
    // -----------------------------------------------------------------------

    if (urlStr === '/api/projects') {
      if (method === 'GET') {
        const projects = await listProjects();
        sendJson(res, 200, projects);
        return;
      }
      if (method === 'POST') {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as { id: string; name: string; parentId?: string };
        try {
          const project = await createProject(body);
          sendJson(res, 201, project);
        } catch (err) {
          if (err instanceof RegistryError) {
            sendError(res, codeToStatus(err.code), err.code, err.message);
            return;
          }
          throw err;
        }
        return;
      }
    }

    // /api/projects/:projectId
    const projectMatch = urlStr.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1]);
      if (method === 'GET') {
        try {
          const project = await getProject(projectId);
          sendJson(res, 200, project);
        } catch (err) {
          if (err instanceof RegistryError) {
            sendError(res, codeToStatus(err.code), err.code, err.message);
            return;
          }
          throw err;
        }
        return;
      }
      if (method === 'DELETE') {
        try {
          await deleteProject(projectId);
          res.writeHead(204);
          res.end();
        } catch (err) {
          if (err instanceof RegistryError) {
            sendError(res, codeToStatus(err.code), err.code, err.message);
            return;
          }
          throw err;
        }
        return;
      }
    }

    // -----------------------------------------------------------------------
    // Tokens
    // -----------------------------------------------------------------------

    // GET /api/projects/:projectId/tokens
    const tokensListMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/tokens$/);
    if (tokensListMatch && method === 'GET') {
      const projectId = decodeURIComponent(tokensListMatch[1]);
      const qs = new URLSearchParams(rawUrl.includes('?') ? rawUrl.split('?')[1] : '');
      const category = qs.get('category') ?? undefined;
      try {
        const tokens = await resolveTokens(projectId, category);
        sendJson(res, 200, tokens);
      } catch (err) {
        if (err instanceof TokensError || err instanceof RegistryError) {
          const e = err as TokensError & { code: string };
          sendError(res, codeToStatus(e.code), e.code, e.message);
          return;
        }
        throw err;
      }
      return;
    }

    // DELETE /api/projects/:projectId/tokens/:key/override
    const tokenOverrideDeleteMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/tokens\/([^/]+)\/override$/);
    if (tokenOverrideDeleteMatch && method === 'DELETE') {
      const projectId = decodeURIComponent(tokenOverrideDeleteMatch[1]);
      const key = decodeURIComponent(tokenOverrideDeleteMatch[2]);
      try {
        await deleteTokenOverride(projectId, key);
        res.writeHead(204);
        res.end();
      } catch (err) {
        if (err instanceof TokensError) {
          sendError(res, codeToStatus(err.code), err.code, err.message);
          return;
        }
        throw err;
      }
      return;
    }

    // PUT /api/projects/:projectId/tokens/:key
    const tokenPutMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/tokens\/([^/]+)$/);
    if (tokenPutMatch && method === 'PUT') {
      const { setOverride: setTokenOverride } = await import('../../tokens/index');
      const projectId = decodeURIComponent(tokenPutMatch[1]);
      const key = decodeURIComponent(tokenPutMatch[2]);
      const raw = await readBody(req);
      const body = JSON.parse(raw) as { value: string; version: number };
      const ifMatch = req.headers['if-match'];
      const version = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : body.version;
      try {
        const token = await setTokenOverride(projectId, key, body.value, version);
        sendJson(res, 200, token);
      } catch (err) {
        if (err instanceof TokensError) {
          sendError(res, codeToStatus(err.code), err.code, err.message);
          return;
        }
        throw err;
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Components
    // -----------------------------------------------------------------------

    // GET /api/projects/:projectId/components
    const componentsListMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/components$/);
    if (componentsListMatch && method === 'GET') {
      const projectId = decodeURIComponent(componentsListMatch[1]);
      try {
        const specs = await listSpecs(projectId);
        sendJson(res, 200, specs);
      } catch (err) {
        if (err instanceof ComponentsError || err instanceof RegistryError) {
          const e = err as ComponentsError & { code: string };
          sendError(res, codeToStatus(e.code), e.code, e.message);
          return;
        }
        throw err;
      }
      return;
    }

    // GET /api/projects/:projectId/components/:componentId
    const componentGetMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/components\/([^/]+)$/);
    if (componentGetMatch && method === 'GET') {
      const projectId = decodeURIComponent(componentGetMatch[1]);
      const componentId = decodeURIComponent(componentGetMatch[2]);
      try {
        const spec = await getSpec(projectId, componentId);
        sendJson(res, 200, spec);
      } catch (err) {
        if (err instanceof ComponentsError || err instanceof RegistryError) {
          const e = err as ComponentsError & { code: string };
          sendError(res, codeToStatus(e.code), e.code, e.message);
          return;
        }
        throw err;
      }
      return;
    }

    // PUT /api/projects/:projectId/components/:componentId/override
    const componentOverridePutMatch = urlStr.match(/^\/api\/projects\/([^/]+)\/components\/([^/]+)\/override$/);
    if (componentOverridePutMatch) {
      const { setOverride: setCompOverride, deleteOverride: deleteCompOverride } = await import(
        '../../components/index'
      );
      const projectId = decodeURIComponent(componentOverridePutMatch[1]);
      const componentId = decodeURIComponent(componentOverridePutMatch[2]);
      if (method === 'PUT') {
        const raw = await readBody(req);
        const body = JSON.parse(raw);
        try {
          const spec = await setCompOverride(projectId, componentId, body);
          sendJson(res, 200, spec);
        } catch (err) {
          if (err instanceof ComponentsError) {
            sendError(res, codeToStatus(err.code), err.code, err.message);
            return;
          }
          throw err;
        }
        return;
      }
      if (method === 'DELETE') {
        try {
          await deleteCompOverride(projectId, componentId);
          res.writeHead(204);
          res.end();
        } catch (err) {
          if (err instanceof ComponentsError) {
            sendError(res, codeToStatus(err.code), err.code, err.message);
            return;
          }
          throw err;
        }
        return;
      }
    }

    // -----------------------------------------------------------------------
    // Validate
    // -----------------------------------------------------------------------

    if (method === 'POST' && urlStr === '/api/validate/color-pair') {
      const raw = await readBody(req);
      const { fg, bg, context } = JSON.parse(raw) as { fg: string; bg: string; context: string };
      if (!COLOR_FORMAT_RE.test(fg) || !COLOR_FORMAT_RE.test(bg)) {
        sendError(res, 400, 'INVALID_COLOR_FORMAT', 'Color must be #RGB, #RRGGBB, or rgb(R,G,B).');
        return;
      }
      if (!['normal', 'large', 'ui'].includes(context)) {
        sendError(res, 400, 'INVALID_CONTEXT', 'Context must be normal, large, or ui.');
        return;
      }
      try {
        const result = validateColorPair(fg, bg, context as 'normal' | 'large' | 'ui');
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof ValidateError) {
          sendError(res, 400, err.code, err.message);
          return;
        }
        throw err;
      }
      return;
    }

    // -----------------------------------------------------------------------
    // MCP JSON-RPC 2.0
    // -----------------------------------------------------------------------

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

      try {
        const { result, error } = await dispatchMcp(rpc);
        if (error) {
          sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, error });
        } else {
          sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id: rpc.id ?? null,
          error: { code: 'INTERNAL_ERROR', message },
        });
      }
      return;
    }

    // 404 fallthrough
    sendError(res, 404, 'NOT_FOUND', method + ' ' + urlStr + ' not found');
  };
}

// ---------------------------------------------------------------------------
// startServer
// ---------------------------------------------------------------------------

export async function startServer(opts?: {
  port?: number;
  secret?: string;
}): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
  const secret = opts?.secret ?? process.env['MCP_SECRET'] ?? '';
  const requestedPort = opts?.port ?? Number(process.env['MCP_PORT'] ?? 0);

  // Reset migration flag so ensureMigrations() re-runs for this server instance.
  _migrationsApplied = false;

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
// CLI entry point — spawned by mcp-server.hooks.ts
// ---------------------------------------------------------------------------

if (require.main === module) {
  if (!process.env['MCP_SECRET']) {
    process.stderr.write('[FATAL] MCP_SECRET must be set in all environments\n');
    process.exit(1);
  }

  const authStatus = 'enabled';

  startServer()
    .then(({ port }) => {
      process.stdout.write('MPDS-MCP listening on port ' + port + ' [auth: ' + authStatus + ']\n');
    })
    .catch((err: unknown) => {
      process.stderr.write('Failed to start MCP server: ' + err + '\n');
      process.exit(1);
    });
}
