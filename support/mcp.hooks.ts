import { Before, After } from '@cucumber/cucumber';
import * as cp from 'child_process';
import { MpdsWorld } from './world';
import { startServer } from '../modules/mcp-server/src/index';

// ---------------------------------------------------------------------------
// Per-scenario server close function (WeakMap keyed by world instance)
// ---------------------------------------------------------------------------
const serverCloseMap = new WeakMap<MpdsWorld, () => Promise<void>>();

// ---------------------------------------------------------------------------
// Before hook — runs for every @mcp scenario
// ---------------------------------------------------------------------------

Before({ tags: '@mcp' }, async function (this: MpdsWorld) {
  this.serverError = false;
  // No child process — server runs in-process so it shares the test DB.
  this.mcpServerProcess = null;

  try {
    const { port, close } = await startServer({
      secret: 'test-secret-123',
      port: 0, // OS-assigned ephemeral port
    });
    this.mcpPort = port;
    process.env.MCP_PORT = String(port);
    process.env.MCP_SECRET = 'test-secret-123';
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
  delete process.env.MCP_SECRET;
});
