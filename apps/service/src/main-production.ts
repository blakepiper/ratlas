import { spawn, type ChildProcess } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadConfig, configPath } from './commands/config.js';

const { values } = parseArgs({ options: { config: { type: 'string' } }, strict: true });
const selected = configPath(values.config);
const config = loadConfig(selected);
if (config.mode !== 'live')
  throw new Error('Continuous production requires configured live sources');
if (!config.radicle.enabled && !config.httpSources.some((s) => s.enabled))
  throw new Error('Continuous production has no enabled sources');
const children = new Set<ChildProcess>();
const exited = new Map<ChildProcess, Promise<void>>();
let stopping = false;
let failure = 0;
function start(entry: string) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL(entry, import.meta.url)), '--config', selected],
    { stdio: 'inherit', detached: true, env: { ...process.env, NODE_ENV: 'production' } },
  );
  children.add(child);
  exited.set(
    child,
    new Promise((resolve) =>
      child.once('close', () => {
        children.delete(child);
        resolve();
      }),
    ),
  );
  child.once('error', () => {
    failure = 1;
    void stop();
  });
  return child;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children)
      if (child.pid)
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Already exited. */
        }
  }, 15000);
  await Promise.all(exited.values());
  clearTimeout(deadline);
  process.exitCode = failure;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void stop();
  });
const api = start('./main-api.js');
api.once('exit', (code) => {
  if (!stopping) {
    failure = code ?? 1;
    void stop();
  }
});
const collector = start('./main-collector.js');
collector.once('exit', (code) => {
  if (!stopping) {
    failure = code ?? 1;
    console.error(
      `ratlas collector exited (${code ?? 'signal'}); API continues serving cached observations. Restart production to resume collection.`,
    );
  }
});
console.log(
  `ratlas continuous production: http://${config.server.host}:${config.server.port}; press Ctrl-C to stop owned API and collector.`,
);
