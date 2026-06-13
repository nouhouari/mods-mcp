import { Before, After } from '@cucumber/cucumber';
import * as net from 'net';
import * as cp from 'child_process';
import * as path from 'path';
import { MpdsWorld } from './world';

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
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a free TCP port by binding to port 0 and reading the OS-assigned port. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

/** Poll GET /health until 200 or timeout. */
async function waitForHealth(port: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.status === 200) return true;
    } catch {
      // server not yet up — keep polling
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Before hook — runs for every @mcp-server scenario
// ---------------------------------------------------------------------------

Before({ tags: '@mcp-server' }, async function (this: MpdsWorld) {
  this.serverError = false;
  this.mcpServerProcess = null;

  let port: number;
  try {
    port = await findFreePort();
  } catch {
    this.serverError = true;
    return;
  }

  this.mcpPort = port;
  process.env.MCP_PORT = String(port);
  process.env.MCP_SECRET = 'test-secret';

  // modules/mcp-server/ is currently empty — spawn will fail immediately.
  // That causes waitForHealth to time out, setting serverError = true, which
  // makes every When step throw a clear "server did not start" error (RED state).
  const serverEntry = path.resolve(
    __dirname,
    '../modules/mcp-server/src/index.ts'
  );

  try {
    const proc = cp.spawn(
      'node',
      ['--require', 'ts-node/register', '--require', 'tsconfig-paths/register', serverEntry],
      {
        env: {
          ...process.env,
          MCP_PORT: String(port),
          MCP_SECRET: 'test-secret',
          DB_PATH: process.env.DB_PATH ?? '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    this.mcpServerProcess = proc;
    // Suppress output so test output stays clean
    proc.stdout?.on('data', () => undefined);
    proc.stderr?.on('data', () => undefined);
  } catch {
    this.serverError = true;
    return;
  }

  const healthy = await waitForHealth(port, 5000);
  if (!healthy) {
    this.serverError = true;
  }
});

// ---------------------------------------------------------------------------
// After hook — tear down server and clean env vars
// ---------------------------------------------------------------------------

After({ tags: '@mcp-server' }, async function (this: MpdsWorld) {
  if (this.mcpServerProcess) {
    try {
      this.mcpServerProcess.kill('SIGTERM');
    } catch {
      // already exited — ignore
    }
    this.mcpServerProcess = null;
  }
  delete process.env.MCP_PORT;
  delete process.env.MCP_SECRET;
});
