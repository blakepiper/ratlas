import { spawn } from 'node:child_process';
import type { Config } from '@ratlas/core';
import { nidSchema } from '@ratlas/core';
import { ndjson } from './ndjson.js';
import { AdapterError } from './errors.js';
import { parseRoute, parseEvent } from './schemas.js';

export function radicleEnvironment(config: Config['radicle']): NodeJS.ProcessEnv {
  if (
    !config.enabled ||
    !config.executablePath?.startsWith('/') ||
    !config.homePath?.startsWith('/')
  )
    throw new AdapterError('unsupported-cli');
  // Do not inherit HOME, RAD_SOCKET, agent sockets, tokens, or application secrets.
  return {
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    RAD_HOME: config.homePath,
    ...(config.socketPath ? { RAD_SOCKET: config.socketPath } : {}),
  };
}
type Command =
  | 'version'
  | 'self-help'
  | 'node-help'
  | 'status-help'
  | 'routing-help'
  | 'events-help'
  | 'home'
  | 'identity'
  | 'routing'
  | 'events';
const commands: Record<Command, string[]> = {
  version: ['--version'],
  'self-help': ['self', '--help'],
  'node-help': ['node', '--help'],
  'status-help': ['node', 'status', '--help'],
  'routing-help': ['node', 'routing', '--help'],
  'events-help': ['node', 'events', '--help'],
  home: ['self', '--home'],
  identity: ['node', 'status', '--only', 'nid'],
  routing: ['node', 'routing', '--json'],
  events: ['node', 'events'],
};
export function runRadicle(
  config: Config['radicle'],
  command: Command,
  signal: AbortSignal,
  timeoutMs?: number,
) {
  const child = spawn(config.executablePath!, commands[command], {
    env: radicleEnvironment(config),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let timedOut = false,
    spawnFailed = false;
  const completed = new Promise<number | null>((resolve) => {
    child.once('error', () => {
      spawnFailed = true;
    });
    child.once('close', (code) => resolve(code));
  });
  // Discard stderr; raw process diagnostics can contain personal paths or IDs.
  child.stderr.resume();
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    killTimer ??= setTimeout(() => child.kill('SIGKILL'), 2000);
    killTimer.unref();
  };
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true;
          stop();
        }, timeoutMs);
  const close = async () => {
    stop();
    await completed;
    if (timer) clearTimeout(timer);
    if (killTimer) clearTimeout(killTimer);
    signal.removeEventListener('abort', stop);
  };
  const check = async () => {
    const code = await completed;
    if (signal.aborted) throw new AdapterError('aborted');
    if (timedOut) throw new AdapterError('timeout');
    if (spawnFailed || code !== 0) throw new AdapterError('process-failed');
  };
  return { stdout: child.stdout, check, close, pid: child.pid };
}
async function textCommand(config: Config['radicle'], command: Command, signal: AbortSignal) {
  const child = runRadicle(config, command, signal, 5000);
  try {
    const buffers: Buffer[] = [];
    let size = 0;
    for await (const chunk of child.stdout) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > 1048576) throw new AdapterError('snapshot-limit');
      buffers.push(bytes);
    }
    await child.check();
    return Buffer.concat(buffers).toString('utf8').trim();
  } finally {
    await child.close();
  }
}
export async function cliCapabilities(
  config: Config['radicle'],
  signal: AbortSignal,
  checkSource = false,
) {
  const version = (await textCommand(config, 'version', signal))
    .replace(/[^\w .+-]/gu, '')
    .slice(0, 160);
  const self = await textCommand(config, 'self-help', signal);
  const node = await textCommand(config, 'node-help', signal);
  const routing = await textCommand(config, 'routing-help', signal);
  const status = await textCommand(config, 'status-help', signal);
  const routingJson = /--json\b/u.test(routing);
  let events = false;
  if (/\bevents\b/u.test(node)) {
    try {
      await textCommand(config, 'events-help', signal);
      events = true;
    } catch {
      /* snapshot-only */
    }
  }
  let observerNid: string | null = null;
  if (checkSource) {
    if (!/--home\b/u.test(self) || !/--only\b/u.test(status) || !routingJson)
      throw new AdapterError('unsupported-cli');
    if ((await textCommand(config, 'home', signal)) !== config.homePath)
      throw new AdapterError('observer-mismatch');
    observerNid = nidSchema.parse(await textCommand(config, 'identity', signal));
  }
  return { version, routingJson, events, observerNid };
}
export async function* routingSnapshot(config: Config, signal: AbortSignal) {
  const child = runRadicle(config.radicle, 'routing', signal, config.collection.snapshotTimeoutMs);
  try {
    for await (const row of ndjson(child.stdout, {
      lineBytes: config.collection.eventLineMaxBytes,
      totalBytes: config.collection.snapshotMaxBytes,
      rows: config.collection.snapshotMaxRows,
    }))
      yield parseRoute(row);
    await child.check();
  } finally {
    await child.close();
  }
}
export async function* eventStream(config: Config, signal: AbortSignal) {
  const child = runRadicle(config.radicle, 'events', signal);
  try {
    for await (const row of ndjson(child.stdout, {
      lineBytes: config.collection.eventLineMaxBytes,
    })) {
      try {
        yield { event: parseEvent(row), malformed: false };
      } catch {
        yield { event: null, malformed: true };
      }
    }
    await child.check();
  } finally {
    await child.close();
  }
}
