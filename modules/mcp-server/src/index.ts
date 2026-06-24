import * as crypto from 'crypto';
import * as http from 'http';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  RegistryError,
} from '../../registry/index';
import {
  resolveTokens,
  createToken,
  getToken,
  listTokens,
  updateToken,
  deleteToken,
  setOverride as setTokenOverride,
  deleteOverride as deleteTokenOverride,
  TokensError,
} from '../../tokens/index';
import {
  listSpecs,
  getSpec,
  createSpec,
  updateSpec,
  deleteSpec,
  ComponentsError,
} from '../../components/index';
import {
  createPattern,
  getPattern,
  listPatterns,
  updatePattern,
  deletePattern,
  createVariant,
  getVariant,
  listVariants,
  updateVariant,
  deleteVariant,
  createCompositionRule,
  listCompositionRules,
  getCompositionRules,
  deleteCompositionRule,
  createLayoutGuideline,
  getLayoutGuideline,
  listLayoutGuidelines,
  updateLayoutGuideline,
  deleteLayoutGuideline,
  PatternsError,
} from '../../patterns/index';
import {
  validateColorPair,
  validateSnippet,
  ValidateError,
  COLOR_FORMAT_RE,
} from '../../validate/index';
import { generateShowcase, PreviewError } from '../../preview';
import { getDb, runMigrations } from '../../db/index';
import { handlePatternRoutes } from '../../patterns/routes';
import helmet from 'helmet';

// ---------------------------------------------------------------------------
// Security constants
// ---------------------------------------------------------------------------

const BODY_LIMIT = 1_048_576; // 1 MB body size cap

// Helmet middleware — applied once per request before rate-limit and auth
const _helmetMiddleware = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
});

function applyHelmet(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    (_helmetMiddleware as unknown as (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      next: () => void
    ) => void)(req, res, resolve);
  });
}

// In-memory rate limiter: max 100 requests per 60-second window per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;
const _rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

function setSecurityHeaders(res: http.ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
}

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
  // Fail-closed: if secret is empty/missing, deny all requests (misconfiguration).
  if (!secret || !secret.trim()) {
    return { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Server authentication is not configured' };
  }
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Invalid bearer token' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  setSecurityHeaders(res);
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
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
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
// MCP tool catalog (for initialize / tools/list)
// ---------------------------------------------------------------------------

const MCP_TOOLS: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [
  // ── Projects ──────────────────────────────────────────────────────────────
  {
    name: 'list_projects',
    description: 'List all design system projects.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_project',
    description: 'Create a new design system project.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique project identifier' },
        name: { type: 'string', description: 'Human-readable project name' },
        parentId: { type: 'string', description: 'Parent project ID for token inheritance (optional)' },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'update_project',
    description: 'Rename a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['projectId', 'name'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },

  // ── Tokens ────────────────────────────────────────────────────────────────
  {
    name: 'get_tokens',
    description: 'Resolve all tokens for a project, including inherited values from parent projects.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        category: { type: 'string', description: 'Filter by category (color, typography, spacing, …)' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'list_tokens',
    description: 'List raw tokens stored directly in a project (no parent inheritance).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_token',
    description: 'Get a single token by key.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
      },
      required: ['projectId', 'key'],
    },
  },
  {
    name: 'create_token',
    description: 'Create a new design token in a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
        category: { type: 'string', enum: ['color', 'typography', 'spacing', 'radius', 'shadow', 'breakpoint', 'border', 'motion', 'other'] },
        value: { type: 'string' },
        isSemantic: { type: 'boolean' },
        semanticRef: { type: 'string', description: 'Key of the primitive token this semantic token references' },
      },
      required: ['projectId', 'key', 'category', 'value'],
    },
  },
  {
    name: 'update_token',
    description: 'Update a token value. Provide the current version for optimistic concurrency control.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
        version: { type: 'number' },
        value: { type: 'string' },
        semanticRef: { type: 'string' },
      },
      required: ['projectId', 'key', 'version'],
    },
  },
  {
    name: 'set_token',
    description: 'Set a token override on a child project (overrides the inherited parent value).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        version: { type: 'number' },
      },
      required: ['projectId', 'key', 'value', 'version'],
    },
  },
  {
    name: 'delete_token',
    description: 'Delete a token.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
        version: { type: 'number' },
      },
      required: ['projectId', 'key', 'version'],
    },
  },
  {
    name: 'delete_token_override',
    description: 'Remove a child-project token override, restoring the inherited parent value.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
      },
      required: ['projectId', 'key'],
    },
  },

  // ── Design system (aggregate) ──────────────────────────────────────────────
  {
    name: 'get_design_system',
    description: 'Get the full resolved token map and component list for a project in one call.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },

  // ── Components ────────────────────────────────────────────────────────────
  {
    name: 'get_component_spec',
    description: 'Get a component specification.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        componentId: { type: 'string' },
      },
      required: ['projectId', 'componentId'],
    },
  },
  {
    name: 'create_component',
    description: 'Create a component specification.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        props: { type: 'object' },
        variants: { type: 'object' },
        states: { type: 'object' },
        usageRules: { type: 'object' },
        accessibilityNotes: { type: 'object' },
      },
      required: ['projectId', 'id', 'name'],
    },
  },
  {
    name: 'update_component',
    description: 'Update a component specification.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        componentId: { type: 'string' },
        version: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        props: { type: 'object' },
        variants: { type: 'object' },
        states: { type: 'object' },
        usageRules: { type: 'object' },
        accessibilityNotes: { type: 'object' },
      },
      required: ['projectId', 'componentId', 'version'],
    },
  },
  {
    name: 'delete_component',
    description: 'Delete a component specification.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        componentId: { type: 'string' },
      },
      required: ['projectId', 'componentId'],
    },
  },

  // ── Validation ────────────────────────────────────────────────────────────
  {
    name: 'validate_color_pair',
    description: 'Check WCAG contrast ratio for a foreground/background color pair.',
    inputSchema: {
      type: 'object',
      properties: {
        fg: { type: 'string', description: 'Foreground color: #RGB, #RRGGBB, or rgb(R,G,B)' },
        bg: { type: 'string', description: 'Background color: #RGB, #RRGGBB, or rgb(R,G,B)' },
        context: { type: 'string', enum: ['normal', 'large', 'ui'] },
      },
      required: ['fg', 'bg', 'context'],
    },
  },
  {
    name: 'validate_token_pair',
    description: 'Validate WCAG contrast for two token keys — resolves their values automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        fgKey: { type: 'string' },
        bgKey: { type: 'string' },
        context: { type: 'string', enum: ['normal', 'large', 'ui'] },
      },
      required: ['projectId', 'fgKey', 'bgKey', 'context'],
    },
  },
  {
    name: 'validate_snippet',
    description: 'Lint an HTML or JSX snippet for accessibility and design-system issues.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        contentType: { type: 'string', enum: ['html', 'jsx'] },
      },
      required: ['content'],
    },
  },

  // ── Guidelines ────────────────────────────────────────────────────────────
  {
    name: 'create_guideline',
    description: 'Create a design guideline entry.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'search_guidelines',
    description: 'Full-text search design guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (empty returns all)' },
      },
    },
  },

  // ── Proposals ─────────────────────────────────────────────────────────────
  {
    name: 'propose_token_override',
    description: 'Submit a proposed token override for human review.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['projectId', 'key', 'value'],
    },
  },
  {
    name: 'list_proposals',
    description: 'List pending token override proposals for a project.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },

  // ── Patterns ──────────────────────────────────────────────────────────────
  {
    name: 'create_pattern',
    description: 'Create a design pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        id: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        guidanceUrl: { type: 'string' },
      },
      required: ['projectId', 'id', 'name', 'category'],
    },
  },
  {
    name: 'update_pattern',
    description: 'Update a design pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        guidanceUrl: { type: 'string' },
      },
      required: ['projectId', 'patternId'],
    },
  },
  {
    name: 'delete_pattern',
    description: 'Delete a design pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternId: { type: 'string' },
      },
      required: ['projectId', 'patternId'],
    },
  },

  // ── Variants ──────────────────────────────────────────────────────────────
  {
    name: 'create_variant',
    description: 'Add a variant to a pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternId: { type: 'string' },
        name: { type: 'string' },
        appliesAt: { type: 'string', description: 'Breakpoint or context where the variant applies' },
        description: { type: 'string' },
      },
      required: ['projectId', 'patternId', 'name', 'appliesAt'],
    },
  },
  {
    name: 'update_variant',
    description: 'Update a pattern variant.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternId: { type: 'string' },
        variantId: { type: 'string' },
        name: { type: 'string' },
        appliesAt: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['projectId', 'patternId', 'variantId'],
    },
  },
  {
    name: 'delete_variant',
    description: 'Delete a pattern variant.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternId: { type: 'string' },
        variantId: { type: 'string' },
      },
      required: ['projectId', 'patternId', 'variantId'],
    },
  },

  // ── Composition rules ─────────────────────────────────────────────────────
  {
    name: 'create_composition_rule',
    description: 'Define a composition rule between two patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        patternAId: { type: 'string' },
        patternBId: { type: 'string' },
        relation: { type: 'string', enum: ['contains', 'excludes', 'recommends', 'requires'] },
        guidance: { type: 'string' },
      },
      required: ['projectId', 'patternAId', 'patternBId', 'relation'],
    },
  },
  {
    name: 'delete_composition_rule',
    description: 'Delete a composition rule.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        ruleId: { type: 'string' },
      },
      required: ['projectId', 'ruleId'],
    },
  },

  // ── Layout guidelines ─────────────────────────────────────────────────────
  {
    name: 'create_layout_guideline',
    description: 'Create a layout guideline.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['projectId', 'type', 'name', 'data'],
    },
  },
  {
    name: 'update_layout_guideline',
    description: 'Update a layout guideline.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        guidelineId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['projectId', 'guidelineId'],
    },
  },
  {
    name: 'delete_layout_guideline',
    description: 'Delete a layout guideline.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        guidelineId: { type: 'string' },
      },
      required: ['projectId', 'guidelineId'],
    },
  },

  // ── Showcase ──────────────────────────────────────────────────────────────
  {
    name: 'generate_showcase',
    description: "Generate an HTML showcase page for a project's design tokens and components.",
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        format: {
          type: 'string',
          enum: ['json', 'html'],
          description: 'json (default) returns { html, …counts }; html returns the raw HTML string directly.',
        },
      },
      required: ['projectId'],
    },
  },
];

// ---------------------------------------------------------------------------
// MCP JSON-RPC dispatcher
// ---------------------------------------------------------------------------

async function dispatchMcp(
  rpc: JsonRpcRequest,
  reqHeaders: http.IncomingHttpHeaders = {}
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

      case 'create_guideline': {
        const { id, title, body, tags } = params as {
          id: string; title: string; body?: string; tags?: string[];
        };
        if (!id || !title) {
          return { error: { code: 'MISSING_FIELD', message: 'id and title are required' } };
        }
        const db = getDb();
        db.exec(`
          CREATE TABLE IF NOT EXISTS guidelines (
            id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          )
        `);
        const now = new Date().toISOString();
        try {
          db.prepare(
            `INSERT INTO guidelines (id, title, body, tags, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(id, title, body ?? '', JSON.stringify(tags ?? []), now, now);
        } catch {
          // Ignore duplicate — idempotent for test setup
        }
        return { result: { id, title } };
      }

      case 'search_guidelines': {
        const query = typeof params['query'] === 'string' ? params['query'] : '';
        const db = getDb();
        // Ensure guidelines table exists (migration may run lazily in tests)
        db.exec(`
          CREATE TABLE IF NOT EXISTS guidelines (
            id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          )
        `);
        let rows: unknown[];
        if (!query || query.trim() === '') {
          rows = db.prepare(
            'SELECT id, title, body, tags FROM guidelines ORDER BY created_at DESC'
          ).all() as unknown[];
        } else {
          try {
            rows = db.prepare(
              `SELECT g.id, g.title, g.body, g.tags, bm25(guidelines_fts) AS bm25_score
               FROM guidelines_fts
               JOIN guidelines g ON g.rowid = guidelines_fts.rowid
               WHERE guidelines_fts MATCH ?
               ORDER BY bm25_score`
            ).all(query) as unknown[];
          } catch {
            // FTS table may not exist yet — fall back to LIKE search
            rows = db.prepare(
              `SELECT id, title, body, tags FROM guidelines
               WHERE title LIKE '%' || ? || '%' OR body LIKE '%' || ? || '%'`
            ).all(query, query) as unknown[];
          }
        }
        const results = (rows as Array<{
          id: string; title: string; body: string; tags: string; bm25_score?: number;
        }>).map(r => ({
          id: r.id,
          title: r.title,
          bodyExcerpt: r.body.slice(0, 200),
          tags: (() => { try { return JSON.parse(r.tags || '[]'); } catch { return []; } })() as string[],
          relevanceScore: r.bm25_score !== undefined
            ? Math.max(0, Math.min(1, 1 / (1 - r.bm25_score)))
            : 1,
        }));
        if (query && query.trim()) {
          results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
        return { result: results };
      }

      case 'propose_token_override': {
        const { projectId, key, value, rationale } = params as {
          projectId: string; key: string; value: string; rationale?: string;
        };
        if (!projectId || !key || value === undefined) {
          return { error: { code: 'MISSING_FIELD', message: 'projectId, key, and value are required' } };
        }
        await getProject(projectId);
        const db = getDb();
        const existing = db.prepare(
          "SELECT id FROM proposals WHERE project_id = ? AND token_key = ? AND status = 'pending'"
        ).get(projectId, key);
        if (existing) {
          return { error: { code: 'PROPOSAL_ALREADY_PENDING', message: 'A pending proposal already exists for this token' } };
        }
        const agentId = (reqHeaders['x-agent-id'] as string) ?? null;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(
          `INSERT INTO proposals (id, project_id, token_key, proposed_value, rationale, agent_id, status, created_at, version)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0)`
        ).run(id, projectId, key, value, rationale ?? null, agentId, now);
        return { result: { proposalId: id, status: 'pending', agentId } };
      }

      case 'list_proposals': {
        const projectId = params['projectId'] as string;
        if (!projectId) {
          return { error: { code: 'MISSING_FIELD', message: 'projectId is required' } };
        }
        await getProject(projectId);
        const db = getDb();
        const rows = db.prepare(
          `SELECT id, project_id, token_key, proposed_value, rationale, agent_id, status, created_at
           FROM proposals WHERE project_id = ? ORDER BY created_at DESC`
        ).all(projectId) as Array<{
          id: string; project_id: string; token_key: string; proposed_value: string;
          rationale: string | null; agent_id: string | null; status: string; created_at: string;
        }>;
        return {
          result: rows.map(r => ({
            proposalId: r.id,
            projectId: r.project_id,
            tokenKey: r.token_key,
            proposedValue: r.proposed_value,
            rationale: r.rationale,
            agentId: r.agent_id,
            status: r.status,
            createdAt: r.created_at,
          })),
        };
      }

      case 'create_project': {
        const { id, name, parentId } = (rpc.params ?? {}) as { id: string; name: string; parentId?: string };
        const result = await createProject({ id, name, parentId });
        return { result };
      }

      case 'update_project': {
        const { projectId, name } = (rpc.params ?? {}) as { projectId: string; name: string };
        const result = await updateProject(projectId, { name });
        return { result };
      }

      case 'delete_project': {
        const { projectId } = (rpc.params ?? {}) as { projectId: string };
        await deleteProject(projectId);
        return { result: { success: true } };
      }

      case 'list_tokens': {
        const { projectId, category } = (rpc.params ?? {}) as { projectId: string; category?: string };
        const result = await listTokens(projectId, category);
        return { result };
      }

      case 'get_token': {
        const { projectId, key } = (rpc.params ?? {}) as { projectId: string; key: string };
        const result = await getToken(projectId, key);
        return { result };
      }

      case 'create_token': {
        const { projectId, key, category, value, isSemantic, semanticRef } = (rpc.params ?? {}) as {
          projectId: string; key: string; category: string; value: string; isSemantic?: boolean; semanticRef?: string;
        };
        const result = await createToken({ projectId, key, category, value, isSemantic: isSemantic ?? false, semanticRef });
        return { result };
      }

      case 'update_token': {
        const { projectId, key, version, value, semanticRef } = (rpc.params ?? {}) as {
          projectId: string; key: string; version: number; value?: string; semanticRef?: string;
        };
        const result = await updateToken(projectId, key, { version, value, semanticRef });
        return { result };
      }

      case 'set_token': {
        const { projectId, key, value, version } = (rpc.params ?? {}) as {
          projectId: string; key: string; value: string; version: number;
        };
        const result = await setTokenOverride(projectId, key, value, version);
        return { result };
      }

      case 'delete_token': {
        const { projectId, key, version } = (rpc.params ?? {}) as { projectId: string; key: string; version: number };
        await deleteToken(projectId, key, version);
        return { result: { success: true } };
      }

      case 'delete_token_override': {
        const { projectId, key } = (rpc.params ?? {}) as { projectId: string; key: string };
        await deleteTokenOverride(projectId, key);
        return { result: { success: true } };
      }

      case 'create_component': {
        const { projectId, id, name, description, props, variants, states, usageRules, accessibilityNotes } = (rpc.params ?? {}) as {
          projectId: string; id: string; name: string; description?: string; props?: unknown; variants?: unknown; states?: unknown; usageRules?: unknown; accessibilityNotes?: unknown;
        };
        const result = await createSpec({ id, projectId, name, description, props, variants, states, usageRules, accessibilityNotes } as Parameters<typeof createSpec>[0]);
        return { result };
      }

      case 'update_component': {
        const { projectId, componentId, version, name, description, props, variants, states, usageRules, accessibilityNotes } = (rpc.params ?? {}) as {
          projectId: string; componentId: string; version: number; name?: string; description?: string; props?: unknown; variants?: unknown; states?: unknown; usageRules?: unknown; accessibilityNotes?: unknown;
        };
        const result = await updateSpec(projectId, componentId, { version, name, description, props, variants, states, usageRules, accessibilityNotes } as Parameters<typeof updateSpec>[2]);
        return { result };
      }

      case 'delete_component': {
        const { projectId, componentId } = (rpc.params ?? {}) as { projectId: string; componentId: string };
        await deleteSpec(projectId, componentId);
        return { result: { success: true } };
      }

      case 'create_pattern': {
        const { projectId, id, name, category, description, tags, guidanceUrl } = (rpc.params ?? {}) as {
          projectId: string; id: string; name: string; category: string; description?: string; tags?: string[]; guidanceUrl?: string;
        };
        const result = await createPattern(projectId, { id, name, category, description, tags, guidanceUrl });
        return { result };
      }

      case 'update_pattern': {
        const { projectId, patternId, name, description, tags, guidanceUrl } = (rpc.params ?? {}) as {
          projectId: string; patternId: string; name?: string; description?: string; tags?: string[]; guidanceUrl?: string;
        };
        const result = await updatePattern(projectId, patternId, { name, description, tags, guidanceUrl });
        return { result };
      }

      case 'delete_pattern': {
        const { projectId, patternId } = (rpc.params ?? {}) as { projectId: string; patternId: string };
        await deletePattern(projectId, patternId);
        return { result: { success: true } };
      }

      case 'create_variant': {
        const { projectId, patternId, name, appliesAt, description } = (rpc.params ?? {}) as {
          projectId: string; patternId: string; name: string; appliesAt: string; description?: string;
        };
        const result = await createVariant(projectId, patternId, { name, appliesAt, description });
        return { result };
      }

      case 'update_variant': {
        const { projectId, patternId, variantId, name, appliesAt, description } = (rpc.params ?? {}) as {
          projectId: string; patternId: string; variantId: string; name?: string; appliesAt?: string; description?: string;
        };
        const result = await updateVariant(projectId, patternId, variantId, { name, appliesAt, description });
        return { result };
      }

      case 'delete_variant': {
        const { projectId, patternId, variantId } = (rpc.params ?? {}) as {
          projectId: string; patternId: string; variantId: string;
        };
        await deleteVariant(projectId, patternId, variantId);
        return { result: { success: true } };
      }

      case 'create_composition_rule': {
        const { projectId, patternAId, patternBId, relation, guidance } = (rpc.params ?? {}) as {
          projectId: string; patternAId: string; patternBId: string; relation: string; guidance?: string;
        };
        const result = await createCompositionRule(projectId, { patternAId, patternBId, relation, guidance });
        return { result };
      }

      case 'delete_composition_rule': {
        const { projectId, ruleId } = (rpc.params ?? {}) as { projectId: string; ruleId: string };
        await deleteCompositionRule(projectId, ruleId);
        return { result: { success: true } };
      }

      case 'create_layout_guideline': {
        const { projectId, type, name, description, data } = (rpc.params ?? {}) as {
          projectId: string; type: string; name: string; description?: string; data: Record<string, unknown>;
        };
        const result = await createLayoutGuideline(projectId, { type, name, description, data });
        return { result };
      }

      case 'update_layout_guideline': {
        const { projectId, guidelineId, name, description, data } = (rpc.params ?? {}) as {
          projectId: string; guidelineId: string; name?: string; description?: string; data?: Record<string, unknown>;
        };
        const result = await updateLayoutGuideline(projectId, guidelineId, { name, description, data });
        return { result };
      }

      case 'delete_layout_guideline': {
        const { projectId, guidelineId } = (rpc.params ?? {}) as { projectId: string; guidelineId: string };
        await deleteLayoutGuideline(projectId, guidelineId);
        return { result: { success: true } };
      }

      case 'generate_showcase': {
        const { projectId, title, format } = (rpc.params ?? {}) as { projectId?: string; title?: string; format?: string };
        if (!projectId || typeof projectId !== 'string') {
          return { error: { code: 'MISSING_FIELD', message: '"projectId" is required' } };
        }
        const result = await generateShowcase(projectId, title);
        // format:"html" → return the raw HTML string directly (no wrapper) for
        // consumers that render the document; default returns { html, ...counts }.
        if (format === 'html') {
          return { result: result.html };
        }
        return { result };
      }

      // ── Standard MCP protocol methods ──────────────────────────────────────

      case 'initialize': {
        return {
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mpds-mcp', version: '0.3.0' },
          },
        };
      }

      case 'notifications/initialized':
      case 'ping': {
        return { result: {} };
      }

      case 'tools/list': {
        return { result: { tools: MCP_TOOLS } };
      }

      case 'tools/call': {
        const toolName = params['name'] as string | undefined;
        const toolArgs = (params['arguments'] ?? {}) as Record<string, unknown>;
        if (!toolName) {
          return { error: { code: 'INVALID_PARAMS', message: '"name" is required for tools/call' } };
        }
        const metaMethods = new Set(['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call']);
        if (metaMethods.has(toolName)) {
          return { error: { code: 'INVALID_PARAMS', message: 'Cannot invoke a meta-method as a tool' } };
        }
        const innerRpc: JsonRpcRequest = { jsonrpc: '2.0', id: null, method: toolName, params: toolArgs };
        const inner = await dispatchMcp(innerRpc, reqHeaders);
        if (inner.error) {
          return {
            result: { content: [{ type: 'text', text: JSON.stringify(inner.error) }], isError: true },
          };
        }
        return {
          result: { content: [{ type: 'text', text: JSON.stringify(inner.result) }] },
        };
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
      err instanceof ValidateError ||
      err instanceof PatternsError ||
      err instanceof PreviewError
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

    // Apply helmet security headers first — before rate-limit and auth
    await applyHelmet(req, res);

    // GET /health — no auth required
    if (method === 'GET' && urlStr === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    // Rate limiting
    const clientIp = (req.socket?.remoteAddress ?? req.headers['x-forwarded-for'] ?? 'unknown') as string;
    if (!checkRateLimit(clientIp)) {
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests — try again later');
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
        let body: { id: string; name: string; parentId?: string };
        try {
          body = JSON.parse(raw) as { id: string; name: string; parentId?: string };
        } catch {
          sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON');
          return;
        }
        // Zod-schema validation: id and name are required non-empty strings
        if (typeof body.id !== 'string' || body.id.trim() === '') {
          sendError(res, 400, 'MISSING_FIELD', '"id" is required and must be a non-empty string');
          return;
        }
        if (typeof body.name !== 'string' || body.name.trim() === '') {
          sendError(res, 400, 'MISSING_FIELD', '"name" is required and must be a non-empty string');
          return;
        }
        if (body.parentId !== undefined && typeof body.parentId !== 'string') {
          sendError(res, 400, 'INVALID_FIELD', '"parentId" must be a string if provided');
          return;
        }
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
      const projectId = decodeURIComponent(tokenPutMatch[1]);
      const key = decodeURIComponent(tokenPutMatch[2]);
      const raw = await readBody(req);
      const body = JSON.parse(raw) as { value: string; version?: unknown };
      const ifMatch = req.headers['if-match'];
      // H1: validate version before OCC — MISSING_VERSION/INVALID_VERSION before calling storage layer
      const rawVersion = ifMatch !== undefined ? parseInt((ifMatch as string).replace(/"/g, ''), 10) : body.version;
      if (rawVersion === undefined || rawVersion === null) {
        sendError(res, 400, 'MISSING_VERSION', 'version is required in request body');
        return;
      }
      if (typeof rawVersion !== 'number' || isNaN(rawVersion as number)) {
        sendError(res, 400, 'INVALID_VERSION', 'version must be a number');
        return;
      }
      const version = rawVersion as number;
      try {
        const { setOverride: setTokenOverride, updateToken: updateTokenFn } = await import('../../tokens/index');
        // F3: fall back to parent_id — dispatch to setOverride (child) or updateToken (base)
        const project = await getProject(projectId);
        const token = project.parentId
          ? await setTokenOverride(projectId, key, body.value as string, version)
          : await updateTokenFn(projectId, key, { version, value: body.value as string });
        sendJson(res, 200, token);
      } catch (err) {
        if (err instanceof TokensError || err instanceof RegistryError) {
          const e = err as { code: string; message: string };
          if (e.code === 'CONFLICT') {
            // F5: sanitize CONFLICT — never expose currentVersion or internal state
            sendError(res, 409, 'CONFLICT', 'Version conflict — reload and retry');
          } else {
            sendError(res, codeToStatus(e.code), e.code, e.message);
          }
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
    // -----------------------------------------------------------------------
    // Patterns
    // -----------------------------------------------------------------------

    if (await handlePatternRoutes(method, urlStr, req, res)) {
      return;
    }

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
        const { result, error } = await dispatchMcp(rpc, req.headers);
        if (error) {
          sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, error });
        } else {
          sendJson(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result });
        }
      } catch (err: unknown) {
        console.error('[MCP RPC] unexpected error:', err);
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id: rpc.id ?? null,
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
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

  // Reset rate-limit store so each test scenario starts with a clean counter.
  _rateLimitStore.clear();

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
    server.listen(requestedPort, '0.0.0.0', () => resolve());
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
  const _mcpSecret = process.env['MCP_SECRET'];
  if (process.env['MPDS_ENV'] === 'production' && (!_mcpSecret || !_mcpSecret.trim())) {
    // Fail-closed at startup: reject an empty OR whitespace-only secret in production
    // (request-time checkAuth also fail-closes; this surfaces misconfiguration immediately).
    process.stderr.write('[FATAL] MCP_SECRET must be set to a non-empty value in production\n');
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
