import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function bearerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header) {
    res.status(401).json({ error: { code: 'MISSING_AUTH_HEADER', message: 'Authorization header required' } });
    return;
  }
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'INVALID_AUTH_SCHEME', message: 'Only Bearer auth is accepted' } });
    return;
  }
  const token = header.slice(7);
  if (!token || token.trim() === '') {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Bearer token is empty' } });
    return;
  }
  const secret = process.env.MCP_SECRET;
  if (secret) {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
      return;
    }
  }
  next();
}
