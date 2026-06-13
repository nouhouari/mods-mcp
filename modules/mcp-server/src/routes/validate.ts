import { Router, Request, Response } from 'express';
import { validateColorPair, ValidateError } from '../../../validate/index';

const router = Router();

router.post('/color-pair', (req: Request, res: Response) => {
  try {
    const { fg, bg, context } = req.body;
    if (!fg || !bg || !context) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'fg, bg, and context are required' } });
      return;
    }
    const result = validateColorPair(fg, bg, context);
    res.json(result);
  } catch (err) {
    if (err instanceof ValidateError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  }
});

export default router;
