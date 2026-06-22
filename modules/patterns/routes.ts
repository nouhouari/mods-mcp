// This module provides route handlers for the patterns API.
// Routes follow the contract: /api/projects/{projectId}/patterns, /api/projects/{projectId}/composition-rules, etc.

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
  // GET /api/projects/{projectId}/patterns (list patterns)
  const listMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns(\/.*)?$/);
  if (method === 'GET' && listMatch && !listMatch[2]) {
    try {
      const projectId = decodeURIComponent(listMatch[1]);
      const qs = new URLSearchParams(urlStr.includes('?') ? urlStr.split('?')[1] : '');
      const limit = qs.get('limit') ? parseInt(qs.get('limit')!, 10) : undefined;
      const offset = qs.get('offset') ? parseInt(qs.get('offset')!, 10) : undefined;
      const category = qs.get('category') ?? undefined;
      const tag = qs.get('tag') ?? undefined;

      const result = await patternsService.listPatterns(projectId, { limit, offset, category, tag });
      sendJson(res, 200, result);
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

  // POST /api/projects/{projectId}/patterns (create pattern)
  if (method === 'POST' && listMatch && !listMatch[2]) {
    try {
      const projectId = decodeURIComponent(listMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createPattern(projectId, payload);
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

  // GET /api/projects/{projectId}/patterns/{patternId} (get pattern)
  const getPatternMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns\/([^/?]+)$/);
  if (method === 'GET' && getPatternMatch) {
    try {
      const projectId = decodeURIComponent(getPatternMatch[1]);
      const patternId = decodeURIComponent(getPatternMatch[2]);
      const result = await patternsService.getPattern(projectId, patternId);
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

  // PATCH /api/projects/{projectId}/patterns/{patternId} (update pattern)
  if (method === 'PATCH' && getPatternMatch) {
    try {
      const projectId = decodeURIComponent(getPatternMatch[1]);
      const patternId = decodeURIComponent(getPatternMatch[2]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updatePattern(projectId, patternId, payload);
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

  // DELETE /api/projects/{projectId}/patterns/{patternId} (delete pattern)
  if (method === 'DELETE' && getPatternMatch) {
    try {
      const projectId = decodeURIComponent(getPatternMatch[1]);
      const patternId = decodeURIComponent(getPatternMatch[2]);
      await patternsService.deletePattern(projectId, patternId);
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

  // POST /api/projects/{projectId}/patterns/{patternId}/variants (create variant)
  const variantCreateMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns\/([^/?]+)\/variants$/);
  if (method === 'POST' && variantCreateMatch) {
    try {
      const projectId = decodeURIComponent(variantCreateMatch[1]);
      const patternId = decodeURIComponent(variantCreateMatch[2]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createVariant(projectId, patternId, payload);
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

  // GET /api/projects/{projectId}/patterns/{patternId}/variants (list variants)
  const variantListMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns\/([^/?]+)\/variants$/);
  if (method === 'GET' && variantListMatch) {
    try {
      const projectId = decodeURIComponent(variantListMatch[1]);
      const patternId = decodeURIComponent(variantListMatch[2]);
      const result = await patternsService.listVariants(projectId, patternId);
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

  // GET /api/projects/{projectId}/patterns/{patternId}/variants/{variantId} (get variant)
  const variantGetMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns\/([^/?]+)\/variants\/([^/?]+)$/);
  if (method === 'GET' && variantGetMatch) {
    try {
      const projectId = decodeURIComponent(variantGetMatch[1]);
      const patternId = decodeURIComponent(variantGetMatch[2]);
      const variantId = decodeURIComponent(variantGetMatch[3]);
      const result = await patternsService.getVariant(projectId, patternId, variantId);
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

  // PATCH /api/projects/{projectId}/patterns/{patternId}/variants/{variantId} (update variant)
  if (method === 'PATCH' && variantGetMatch) {
    try {
      const projectId = decodeURIComponent(variantGetMatch[1]);
      const patternId = decodeURIComponent(variantGetMatch[2]);
      const variantId = decodeURIComponent(variantGetMatch[3]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updateVariant(projectId, patternId, variantId, payload);
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

  // DELETE /api/projects/{projectId}/patterns/{patternId}/variants/{variantId} (delete variant)
  if (method === 'DELETE' && variantGetMatch) {
    try {
      const projectId = decodeURIComponent(variantGetMatch[1]);
      const patternId = decodeURIComponent(variantGetMatch[2]);
      const variantId = decodeURIComponent(variantGetMatch[3]);
      await patternsService.deleteVariant(projectId, patternId, variantId);
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

  // POST /api/projects/{projectId}/composition-rules (create composition rule)
  const compositionCreateMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/composition-rules$/);
  if (method === 'POST' && compositionCreateMatch) {
    try {
      const projectId = decodeURIComponent(compositionCreateMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createCompositionRule(projectId, payload);
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

  // GET /api/projects/{projectId}/composition-rules (list composition rules)
  const compositionListMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/composition-rules(\/.*)?$/);
  if (method === 'GET' && compositionListMatch && !compositionListMatch[2]) {
    try {
      const projectId = decodeURIComponent(compositionListMatch[1]);
      const qs = new URLSearchParams(urlStr.includes('?') ? urlStr.split('?')[1] : '');
      const limit = qs.get('limit') ? parseInt(qs.get('limit')!, 10) : undefined;
      const offset = qs.get('offset') ? parseInt(qs.get('offset')!, 10) : undefined;
      const result = await patternsService.listCompositionRules(projectId, { limit, offset });
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  // DELETE /api/projects/{projectId}/composition-rules/{ruleId} (delete composition rule)
  const ruleDeleteMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/composition-rules\/([^/?]+)$/);
  if (method === 'DELETE' && ruleDeleteMatch) {
    try {
      const projectId = decodeURIComponent(ruleDeleteMatch[1]);
      const ruleId = decodeURIComponent(ruleDeleteMatch[2]);
      await patternsService.deleteCompositionRule(projectId, ruleId);
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

  // GET /api/projects/{projectId}/patterns/{patternId}/composition-rules (get composition rules for pattern)
  const compositionGetMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/patterns\/([^/?]+)\/composition-rules$/);
  if (method === 'GET' && compositionGetMatch) {
    try {
      const projectId = decodeURIComponent(compositionGetMatch[1]);
      const patternId = decodeURIComponent(compositionGetMatch[2]);
      const result = await patternsService.getCompositionRules(projectId, patternId);
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

  // POST /api/projects/{projectId}/layout-guidelines (create layout guideline)
  const guidelineCreateMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/layout-guidelines$/);
  if (method === 'POST' && guidelineCreateMatch) {
    try {
      const projectId = decodeURIComponent(guidelineCreateMatch[1]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.createLayoutGuideline(projectId, payload);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err instanceof patternsService.PatternsError) {
        const status = err.code === 'GUIDELINE_NOT_FOUND' ? 404 : 400;
        sendError(res, status, err.code, err.message);
      } else {
        console.error('Unexpected error:', err);
        sendError(res, 500, 'INTERNAL_ERROR', err.message);
      }
    }
    return true;
  }

  // GET /api/projects/{projectId}/layout-guidelines (list layout guidelines)
  const guidelineListMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/layout-guidelines(\/.*)?$/);
  if (method === 'GET' && guidelineListMatch && !guidelineListMatch[2]) {
    try {
      const projectId = decodeURIComponent(guidelineListMatch[1]);
      const qs = new URLSearchParams(urlStr.includes('?') ? urlStr.split('?')[1] : '');
      const limit = qs.get('limit') ? parseInt(qs.get('limit')!, 10) : undefined;
      const offset = qs.get('offset') ? parseInt(qs.get('offset')!, 10) : undefined;
      const result = await patternsService.listLayoutGuidelines(projectId, { limit, offset });
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
    return true;
  }

  // GET /api/projects/{projectId}/layout-guidelines/{guidelineId} (get layout guideline)
  const guidelineGetMatch = urlStr.match(/^\/api\/projects\/([^/?]+)\/layout-guidelines\/([^/?]+)$/);
  if (method === 'GET' && guidelineGetMatch) {
    try {
      const projectId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      const result = await patternsService.getLayoutGuideline(projectId, guidelineId);
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

  // PATCH /api/projects/{projectId}/layout-guidelines/{guidelineId} (update layout guideline)
  if (method === 'PATCH' && guidelineGetMatch) {
    try {
      const projectId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await patternsService.updateLayoutGuideline(projectId, guidelineId, payload);
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

  // DELETE /api/projects/{projectId}/layout-guidelines/{guidelineId} (delete layout guideline)
  if (method === 'DELETE' && guidelineGetMatch) {
    try {
      const projectId = decodeURIComponent(guidelineGetMatch[1]);
      const guidelineId = decodeURIComponent(guidelineGetMatch[2]);
      await patternsService.deleteLayoutGuideline(projectId, guidelineId);
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

  return false;
}
