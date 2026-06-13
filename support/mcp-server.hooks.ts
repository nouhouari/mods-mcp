import * as crypto from 'crypto';
import { Before, After } from '@cucumber/cucumber';
import * as net from 'net';
import * as http from 'http';
import * as cp from 'child_process';
import { MpdsWorld } from './world';
import { startServer } from '../modules/mcp-server/src/index';

// ---------------------------------------------------------------------------
// Module augmentation — extend MpdsWorld without touching world.ts.
// The steps file declares the same augmentation against '../support/world';
// TypeScript resolves both to the same interface at compile time.
// ---------------------------------------------------------------------------
declare module './world' {
  interface MpdsWorld {
    mcpPort: number;
    mcpServerProcess: cp.ChildProcess | null;
    lastStatus: number;
    serverError: boolean;
    mcpSecret: string;
  }
}

// ---------------------------------------------------------------------------
// Per-scenario server close function (WeakMap keyed by world instance)
// ---------------------------------------------------------------------------
const serverCloseMap = new WeakMap<MpdsWorld, () => Promise<void>>();

// ---------------------------------------------------------------------------
// Before hook — runs for every @mcp-server scenario
// ---------------------------------------------------------------------------

Before({ tags: '@mcp-server' }, async function (this: MpdsWorld) {
  this.serverError = false;
  // No child process — server runs in-process so it shares the test DB.
  this.mcpServerProcess = null;

  try {
    const secret = crypto.randomBytes(32).toString('hex');
    const { port, close } = await startServer({
      secret,
      port: 0, // OS-assigned
    });
    this.mcpPort = port;
    this.mcpSecret = secret;
    process.env.MCP_PORT = String(port);
    process.env.MCP_SECRET = secret;
    serverCloseMap.set(this, close);
  } catch {
    this.serverError = true;
  }
});

// ---------------------------------------------------------------------------
// After hook — tear down server and clean env vars
// ---------------------------------------------------------------------------

After({ tags: '@mcp-server' }, async function (this: MpdsWorld) {
  const close = serverCloseMap.get(this);
  if (close) {
    try {
      await close();
    } catch {
      // already closed — ignore
    }
    serverCloseMap.delete(this);
  }
  delete process.env.MCP_PORT;
  delete process.env.MCP_SECRET;
});
