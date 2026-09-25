import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Owner {
  pid: number;
  start: string;
  host: string;
  nonce: string;
}
export function processStart(pid: number): string {
  const stat = readFileSync('/proc/' + pid + '/stat', 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]!;
}
export function ownerIsDead(owner: Owner): boolean {
  if (
    typeof owner.start !== 'string' ||
    !/^\d+$/u.test(owner.start) ||
    typeof owner.nonce !== 'string'
  )
    return false;
  if (owner.host !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0) return false;
  try {
    return processStart(owner.pid) !== owner.start;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}
export function acquireLease(databasePath: string) {
  const directory = databasePath + '.writer-lock';
  const ownerPath = join(directory, 'owner.json');
  const owner: Owner = {
    pid: process.pid,
    start: processStart(process.pid),
    host: hostname(),
    nonce: randomUUID(),
  };
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let previous: Owner;
    try {
      previous = JSON.parse(readFileSync(ownerPath, 'utf8')) as Owner;
    } catch (cause) {
      throw new Error('Database writer ownership is unknown; operator review required', { cause });
    }
    if (!ownerIsDead(previous))
      throw new Error('Database writer lease is active or cannot be established', { cause: error });
    // Reclamation itself is exclusive, so concurrent starters cannot remove a new owner's lock.
    const reclaim = join(directory, 'reclaim');
    mkdirSync(reclaim, { mode: 0o700 });
    try {
      const current = JSON.parse(readFileSync(ownerPath, 'utf8')) as Owner;
      if (current.nonce !== previous.nonce || !ownerIsDead(current))
        throw new Error('Writer ownership changed', { cause: error });
      unlinkSync(ownerPath);
      try {
        unlinkSync(join(directory, 'heartbeat'));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    } finally {
      rmdirSync(reclaim);
    }
    rmdirSync(directory);
    mkdirSync(directory, { mode: 0o700 });
  }
  writeFileSync(ownerPath, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
  const heartbeat = () =>
    writeFileSync(join(directory, 'heartbeat'), String(Date.now()), { mode: 0o600 });
  heartbeat();
  const timer = setInterval(heartbeat, 10000);
  timer.unref();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    clearInterval(timer);
    const current = JSON.parse(readFileSync(ownerPath, 'utf8')) as Owner;
    if (current.nonce !== owner.nonce) throw new Error('Writer lease owner changed');
    unlinkSync(join(directory, 'heartbeat'));
    unlinkSync(ownerPath);
    rmdirSync(directory);
  };
}
