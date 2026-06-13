import * as crypto from 'crypto';
import { Before, After } from '@cucumber/cucumber';
import * as cp from 'child_process';
import { MpdsWorld } from './world';
import { startServer } from '../modules/mcp-server/src/index';

// ---------------------------------------------------------------------------
// Per-scenario server close function (WeakMap keyed by world instance)
// ---------------------------------------------------------------------------
const serverCloseMap = new WeakMap<MpdsWorld, () => Promise<void>>();

// Module augmentation — adds mcpSecret to MpdsWorld so step-defs can read
// the scenario-isolated secret without racing on process.env.
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
// Before hook — runs for every @mcp scenario
// ---------------------------------------------------------------------------

Before({ tags: '@mcp' }, async function (this: MpdsWorld) {
  this.serverError = false;
  // No child process — server runs in-process so it shares the test DB.
  this.mcpServerProcess = null;

  try {
    // Fresh secret per scenario — avoids the static 'test-secret-123' that was
    // previously shared across all scenarios and raced with @mcp-server hooks
    // writing to the same process.env.MCP_SECRET key.
    const secret = crypto.randomBytes(32).toString('hex');
    const { port, close } = await startServer({
      secret,
      port: 0, // OS-assigned ephemeral port
    });
    this.mcpPort = port;
    this.mcpSecret = secret;
    // MCP_PORT is still set on process.env so baseUrl() helpers that read it continue
    // to work; MCP_SECRET is intentionally NOT written to process.env to eliminate
    // the race between concurrent hook sets.
    process.env.MCP_PORT = String(port);
    serverCloseMap.set(this, close);
  } catch {
    this.serverError = true;
  }
});

// ---------------------------------------------------------------------------
// After hook — tear down server and clean env vars
// ---------------------------------------------------------------------------

After({ tags: '@mcp' }, async function (this: MpdsWorld) {
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
});
