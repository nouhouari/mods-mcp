// This module provides route handlers for the patterns API.
// These are exported as functions that can be integrated into the mcp-server request handler.

import * as http from 'http';
import * as patternsService from './index';

// Helper to send JSON response
function sendJson(res: http.ServerResponse, status: number, body: any): void {
  const payload = JSON.stringify(body);
  const len = Buffer.byteLength(payload, 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': len });
  res.end(payload);
}

// Helper to send error response
function sendError(res: http.ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } });
}

// Helper to read request body
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const limit = 1_048_576; // 1 MB
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Pattern CRUD route handlers
export async function handlePatternRoutes(
  method: string,
  urlStr: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  // POST /api/v1/patterns
  if (method === 'POST' && urlStr === '/api/v1/patterns') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createPattern(payload);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 400, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/patterns (with optional query params)
  if (method === 'GET' && urlStr.startsWith('/api/v1/patterns')) {
    // Check if this is a pattern ID fetch or a list
    const patternMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)(\/.*)?$/);
    if (patternMatch) {
      // This is handled by pattern-specific routes below
      return false;
    }

    // This is a list request
    if (urlStr === '/api/v1/patterns' || urlStr.startsWith('/api/v1/patterns?')) {
      try {
        const qs = new URLSearchParams(urlStr.includes('?') ? urlStr.split('?')[1] : '');
        const limit = qs.get('limit') ? parseInt(qs.get('limit')!, 10) : undefined;
        const offset = qs.get('offset') ? parseInt(qs.get('offset')!, 10) : undefined;
        const category = qs.get('category') ?? undefined;

        const result = await patternsService.listPatterns({ limit, offset, category });
        sendJson(res, 200, result);
      } catch (err: any) {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
      return true;
    }
  }

  // GET /api/v1/patterns/:patternId
  const patternGetMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)$/);
  if (method === 'GET' && patternGetMatch) {
    try {
      const patternId = decodeURIComponent(patternGetMatch[1]);
      const result = await patternsService.getPattern(patternId);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // PATCH /api/v1/patterns/:patternId
  const patternPatchMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)$/);
  if (method === 'PATCH' && patternPatchMatch) {
    try {
      const patternId = decodeURIComponent(patternPatchMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updatePattern(patternId, payload);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // DELETE /api/v1/patterns/:patternId
  const patternDeleteMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)$/);
  if (method === 'DELETE' && patternDeleteMatch) {
    try {
      const patternId = decodeURIComponent(patternDeleteMatch[1]);
      await patternsService.deletePattern(patternId);
      res.writeHead(204);
      res.end();
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // POST /api/v1/patterns/:patternId/variants
  const variantCreateMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/variants$/);
  if (method === 'POST' && variantCreateMatch) {
    try {
      const patternId = decodeURIComponent(variantCreateMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createVariant(patternId, payload);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        const status = err.code === 'PATTERN_NOT_FOUND' ? 404 : 400;
        sendError(res, status, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/patterns/:patternId/variants
  const variantListMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/variants$/);
  if (method === 'GET' && variantListMatch) {
    try {
      const patternId = decodeURIComponent(variantListMatch[1]);
      const result = await patternsService.listVariants(patternId);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/patterns/:patternId/variants/:variantName
  const variantGetMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/variants\/([^/?]+)$/);
  if (method === 'GET' && variantGetMatch) {
    try {
      const patternId = decodeURIComponent(variantGetMatch[1]);
      const variantName = decodeURIComponent(variantGetMatch[2]);
      const result = await patternsService.getVariant(patternId, variantName);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // PATCH /api/v1/patterns/:patternId/variants/:variantName
  if (method === 'PATCH' && variantGetMatch) {
    try {
      const patternId = decodeURIComponent(variantGetMatch[1]);
      const variantName = decodeURIComponent(variantGetMatch[2]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updateVariant(patternId, variantName, payload);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // DELETE /api/v1/patterns/:patternId/variants/:variantName
  if (method === 'DELETE' && variantGetMatch) {
    try {
      const patternId = decodeURIComponent(variantGetMatch[1]);
      const variantName = decodeURIComponent(variantGetMatch[2]);
      await patternsService.deleteVariant(patternId, variantName);
      res.writeHead(204);
      res.end();
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // POST /api/v1/composition-rules
  if (method === 'POST' && urlStr === '/api/v1/composition-rules') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createCompositionRule(payload);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        const status = err.code === 'PATTERN_NOT_FOUND' ? 404 : 400;
        sendError(res, status, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/composition-rules
  if (method === 'GET' && (urlStr === '/api/v1/composition-rules' || urlStr.startsWith('/api/v1/composition-rules?'))) {
    try {
      const qs = new URLSearchParams(urlStr.includes('?') ? urlStr.split('?')[1] : '');
      const limit = qs.get('limit') ? parseInt(qs.get('limit')!, 10) : undefined;
      const offset = qs.get('offset') ? parseInt(qs.get('offset')!, 10) : undefined;
      const result = await patternsService.listCompositionRules({ limit, offset });
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  // GET /api/v1/patterns/:patternId/composition-rules
  const compositionListMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/composition-rules$/);
  if (method === 'GET' && compositionListMatch) {
    try {
      const patternId = decodeURIComponent(compositionListMatch[1]);
      const result = await patternsService.getCompositionRules(patternId);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // DELETE /api/v1/composition-rules/:ruleId
  const ruleDeleteMatch = urlStr.match(/^\/api\/v1\/composition-rules\/([^/?]+)$/);
  if (method === 'DELETE' && ruleDeleteMatch) {
    try {
      const ruleId = decodeURIComponent(ruleDeleteMatch[1]);
      await patternsService.deleteCompositionRule(ruleId);
      res.writeHead(204);
      res.end();
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // POST /api/v1/patterns/:patternId/layout-guidelines
  const guidelineCreateMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/layout-guidelines$/);
  if (method === 'POST' && guidelineCreateMatch) {
    try {
      const patternId = decodeURIComponent(guidelineCreateMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createLayoutGuideline(patternId, payload);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        const status = err.code === 'PATTERN_NOT_FOUND' ? 404 : 400;
        sendError(res, status, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/patterns/:patternId/layout-guidelines
  const guidelineListMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/layout-guidelines$/);
  if (method === 'GET' && guidelineListMatch) {
    try {
      const patternId = decodeURIComponent(guidelineListMatch[1]);
      const result = await patternsService.listLayoutGuidelines(patternId);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/v1/patterns/:patternId/layout-guidelines/:guidelineId
  const guidelineGetMatch = urlStr.match(/^\/api\/v1\/patterns\/([^/?]+)\/layout-guidelines\/([^/?]+)$/);
  if (method === 'GET' && guidelineGetMatch) {
    try {
      const patternId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      const result = await patternsService.getLayoutGuideline(patternId, guidelineId);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // PATCH /api/v1/patterns/:patternId/layout-guidelines/:guidelineId
  if (method === 'PATCH' && guidelineGetMatch) {
    try {
      const patternId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updateLayoutGuideline(patternId, guidelineId, payload);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // DELETE /api/v1/patterns/:patternId/layout-guidelines/:guidelineId
  if (method === 'DELETE' && guidelineGetMatch) {
    try {
      const patternId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      await patternsService.deleteLayoutGuideline(patternId, guidelineId);
      res.writeHead(204);
      res.end();
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        sendError(res, 404, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // POST /api/v1/patterns/validate
  if (method === 'POST' && urlStr === '/api/v1/patterns/validate') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.validatePattern(payload);
      sendJson(res, result.status === 'valid' ? 200 : 400, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  // POST /api/v1/patterns/batch-validate
  if (method === 'POST' && urlStr === '/api/v1/patterns/batch-validate') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.validatePatternBatch(payload);
      sendJson(res, 207, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  // POST /api/v1/patterns/lint
  if (method === 'POST' && urlStr === '/api/v1/patterns/lint') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.lintPattern(payload);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  return false; // Not a patterns route
}
