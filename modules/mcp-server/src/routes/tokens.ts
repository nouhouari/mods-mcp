import { Router, Request, Response } from 'express';
import { resolveTokens, setOverride, deleteOverride, TokensError } from '../../../tokens/index';

const router = Router({ mergeParams: true });

const TOKENS_STATUS: Record<string, number> = {
  CONFLICT: 409,
  TOKEN_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  INVALID_CATEGORY: 400,
};

function handleTokensError(err: unknown, res: Response): boolean {
  if (err instanceof TokensError) {
    const status = TOKENS_STATUS[err.code] ?? 500;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return true;
  }
  return false;
}

router.get('/:projectId/tokens', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const category = req.query.category as string | undefined;
    const tokens = await resolveTokens(projectId, category);
    res.json(tokens);
  } catch (err) {
    if (!handleTokensError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.put('/:projectId/tokens/:key', async (req: Request, res: Response) => {
  try {
    const { projectId, key } = req.params;
    const { value, version } = req.body;
    const token = await setOverride(projectId, key, value, version ?? 0);
    res.json(token);
  } catch (err) {
    if (!handleTokensError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.delete('/:projectId/tokens/:key/override', async (req: Request, res: Response) => {
  try {
    const { projectId, key } = req.params;
    await deleteOverride(projectId, key);
    res.status(204).send();
  } catch (err) {
    if (!handleTokensError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

export default router;
