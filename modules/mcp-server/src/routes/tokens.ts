import { Router, Request, Response } from 'express';
import { resolveTokens, setOverride, deleteOverride, TokensError } from '../../../tokens/index';

const router = Router({ mergeParams: true });

const TOKENS_STATUS: Record<string, number> = {
  CONFLICT: 409,
  TOKEN_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  INVALID_CATEGORY: 400,
  MISSING_VERSION: 400,
  INVALID_VERSION: 400,
};

function handleTokensError(err: unknown, res: Response): boolean {
  if (err instanceof TokensError) {
    const status = TOKENS_STATUS[err.code] ?? 500;
    if (err.code === 'CONFLICT') {
      // Sanitize CONFLICT response — never expose currentVersion or internal state
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Version conflict — reload and retry' } });
    } else {
      res.status(status).json({ error: { code: err.code, message: err.message } });
    }
    return true;
  }
  return false;
}

router.get('/:projectId/tokens', async (req: Request, res: Response) => {
  try {
    const projectId = req.params['projectId'] as string;
    const category = req.query.category as string | undefined;
    const tokens = await resolveTokens(projectId, category);
    res.json(tokens);
  } catch (err) {
    if (!handleTokensError(err, res)) {
      console.error('[GET /tokens] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

router.put('/:projectId/tokens/:key', async (req: Request, res: Response) => {
  try {
    const projectId = req.params['projectId'] as string;
    const key = req.params['key'] as string;
    const { value, version } = req.body as { value: string; version: unknown };

    // H1: validate body BEFORE OCC — never default to version 0 (bypass vector)
    if (version === undefined || version === null) {
      res.status(400).json({ error: { code: 'MISSING_VERSION', message: 'version is required in request body' } });
      return;
    }
    if (typeof version !== 'number') {
      res.status(400).json({ error: { code: 'INVALID_VERSION', message: 'version must be a number' } });
      return;
    }

    const token = await setOverride(projectId, key, value, version);
    res.json(token);
  } catch (err) {
    if (!handleTokensError(err, res)) {
      console.error('[PUT /tokens/:key] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

router.delete('/:projectId/tokens/:key/override', async (req: Request, res: Response) => {
  try {
    const projectId = req.params['projectId'] as string;
    const key = req.params['key'] as string;
    await deleteOverride(projectId, key);
    res.status(204).send();
  } catch (err) {
    if (!handleTokensError(err, res)) {
      console.error('[DELETE /tokens/:key/override] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

export default router;
