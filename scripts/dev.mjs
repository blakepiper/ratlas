import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const demo = process.argv[2] === 'demo';
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: demo ? { dataset: { type: 'string' } } : { config: { type: 'string' } },
  strict: true,
  allowPositionals: false,
});
if (demo && values.dataset && !['small', 'target'].includes(values.dataset))
  throw new Error('Demo dataset must be small or target');
const configPath = demo
  ? values.dataset === 'target'
    ? 'config/ratlas.target.json'
    : 'config/ratlas.demo.json'
  : values.config;
const configArgs = configPath ? ['--config', configPath] : [];
execFileSync('pnpm', ['exec', 'tsc', '-b'], { stdio: 'inherit' });
const { loadConfig } = await import('../apps/service/dist/commands/config.js');
const config = loadConfig(configPath);
if (config.server.port !== 3000)
  throw new Error('Development requires API port 3000 for the fixed Vite proxy');
for (const port of [3000, 5173]) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (cause) =>
      reject(
        new Error(`Port ${port} is occupied; stop its owner before starting ratlas`, { cause }),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
if (demo && values.dataset === 'target' && !existsSync('.ratlas/demo/target.sqlite'))
  execFileSync('pnpm', ['data:target'], { stdio: 'inherit' });
execFileSync('pnpm', ['exec', 'tsx', 'scripts/prepare.ts', ...configArgs], { stdio: 'inherit' });
const children = [];
let stopping = false;
const exits = [];
function start(command, args, env = process.env) {
  // Watchers must not take over the terminal's input/raw mode; the supervisor
  // owns Ctrl-C and forwards termination to each child process group.
  const child = spawn(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
    env,
  });
  children.push(child);
  exits.push(new Promise((resolve) => child.once('close', resolve)));
  child.once('error', (error) => {
    console.error(error.message);
    void shutdown(1);
  });
  child.once('exit', (code) => {
    if (!stopping) void shutdown(code || 1);
  });
}
function signalChildren(signal) {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  console.log('Stopping ratlas API and development watchers…');
  signalChildren('SIGTERM');
  const timer = setTimeout(() => signalChildren('SIGKILL'), 5000);
  await Promise.all(exits);
  // A watch-process leader can exit before its descendants; wait for its group.
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const remaining = children.some((child) => {
      if (!child.pid) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
        return false;
      }
    });
    if (!remaining) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  clearTimeout(timer);
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(signal, () => {
    void shutdown(0);
  });
process.on('exit', () => signalChildren('SIGTERM'));
start('pnpm', ['exec', 'tsc', '-b', '--watch', '--preserveWatchOutput']);
start(
  process.execPath,
  ['--watch', '--watch-preserve-output', 'apps/service/dist/main-api.js', ...configArgs],
  { ...process.env, NODE_ENV: 'development' },
);
start('pnpm', ['--filter', '@ratlas/web', 'exec', 'vite']);
console.log(
  `ratlas supervisor PID ${process.pid}: http://127.0.0.1:5173; ${config.mode} dataset; no collector`,
);
