import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { bearerMiddleware } from './auth';

function makeReq(authHeader?: string): Request {
  return { headers: { ...(authHeader ? { authorization: authHeader } : {}) } } as unknown as Request;
}

function makeRes(): Response & { _status: number } {
  const res = {
    _status: 200 as number,
    status(code: number) { this._status = code; return this; },
    json(_body: unknown) { return this; },
  };
  return res as unknown as Response & { _status: number };
}

const CORRECT = 'correct-secret-for-test';

describe('bearerMiddleware', () => {
  const savedSecret = process.env.MCP_SECRET;

  beforeEach(() => { process.env.MCP_SECRET = CORRECT; });
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.MCP_SECRET;
    else process.env.MCP_SECRET = savedSecret;
  });

  test('wrong token returns 401', () => {
    const req = makeReq('Bearer wrong-token');
    const res = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    bearerMiddleware(req, res, next);
    assert.equal(res._status, 401);
    assert.equal(nextCalled, false);
  });

  test('correct token calls next', () => {
    const req = makeReq(`Bearer ${CORRECT}`);
    const res = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    bearerMiddleware(req, res, next);
    assert.equal(nextCalled, true);
  });

  test('no MCP_SECRET set returns 401 for any token', () => {
    delete process.env.MCP_SECRET;
    const req = makeReq('Bearer any-token');
    const res = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    bearerMiddleware(req, res, next);
    assert.equal(res._status, 401);
    assert.equal(nextCalled, false);
  });

  test('missing auth header returns 401', () => {
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    bearerMiddleware(req, res, next);
    assert.equal(res._status, 401);
    assert.equal(nextCalled, false);
  });
});
