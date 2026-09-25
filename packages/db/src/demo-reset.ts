import { randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { dataset, summary } from './queries.js';
import { migrate, openReader, openWriter } from './connection.js';
import { DEMO_REFERENCE, generateSmallDemo, generateTargetDemo } from './demo.js';
import { acquireLease } from './lease.js';
import { nativeDatabase } from './native.js';

export type DemoDataset = 'small' | 'target';

function databaseInUse(path: string) {
  const files = new Set([path, path + '-wal', path + '-shm']);
  for (const pid of readdirSync('/proc')) {
    if (!/^\d+$/u.test(pid)) continue;
    let descriptors: string[];
    try {
      descriptors = readdirSync(`/proc/${pid}/fd`);
    } catch (error) {
      if (['ENOENT', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? ''))
        continue;
      throw error;
    }
    for (const descriptor of descriptors) {
      try {
        const opened = readlinkSync(`/proc/${pid}/fd/${descriptor}`).replace(/ \(deleted\)$/u, '');
        if (files.has(opened)) return true;
      } catch (error) {
        if (['ENOENT', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? ''))
          continue;
        throw error;
      }
    }
  }
  return false;
}

export function resetDemoDataset(root: string, choice: DemoDataset) {
  const directory = resolve(root, '.ratlas/demo');
  const path = resolve(directory, choice === 'target' ? 'target.sqlite' : 'ratlas.sqlite');
  if (!existsSync(path) || !lstatSync(path).isFile() || realpathSync(path) !== path)
    throw new Error('Reset requires an existing canonical demo database; run pnpm demo first');
  if (realpathSync(directory) !== directory)
    throw new Error('Demo directory must not be a symlink');
  const release = acquireLease(path);
  const replacement = resolve(directory, '.reset-' + randomUUID() + '.sqlite');
  try {
    if (databaseInUse(path)) throw new Error('Demo database is in use; stop its API first');
    const reader = openReader(path, { allowMigration: true });
    try {
      if (dataset(reader).kind !== 'demo') throw new Error('Refusing to reset a live database');
    } finally {
      reader.close();
    }
    const fresh = openWriter(replacement);
    try {
      migrate(fresh.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
      if (choice === 'target')
        generateTargetDemo(fresh.db, (completed) => {
          if (completed % 2000 === 0) global.gc?.();
        });
      else generateSmallDemo(fresh.db);
    } finally {
      fresh.close();
    }
    const freshReader = openReader(replacement);
    let counts: ReturnType<typeof summary>;
    try {
      counts = summary(freshReader);
    } finally {
      freshReader.close();
    }
    if (databaseInUse(path)) throw new Error('Demo database is in use; stop its API first');
    const old = nativeDatabase(path, { fileMustExist: true });
    try {
      const result = old.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
      if (result[0]?.busy) throw new Error('Demo database is busy; stop its API first');
    } finally {
      old.close();
    }
    if (databaseInUse(path)) throw new Error('Demo database is in use; stop its API first');
    for (const file of [path, replacement]) {
      if (existsSync(file + '-wal') && statSync(file + '-wal').size !== 0)
        throw new Error('Demo database has an uncheckpointed WAL; stop its API first');
      rmSync(file + '-wal', { force: true });
      rmSync(file + '-shm', { force: true });
    }
    const archiveDirectory = resolve(directory, 'archive');
    mkdirSync(archiveDirectory, { recursive: true, mode: 0o700 });
    if (realpathSync(archiveDirectory) !== archiveDirectory)
      throw new Error('Demo archive directory must not be a symlink');
    const backup = resolve(archiveDirectory, `${basename(path)}.${Date.now()}-${randomUUID()}`);
    renameSync(path, backup);
    try {
      renameSync(replacement, path);
    } catch (error) {
      renameSync(backup, path);
      throw error;
    }
    return { dataset: choice, path, archivedPrevious: backup, summary: counts };
  } finally {
    for (const suffix of ['', '-wal', '-shm']) rmSync(replacement + suffix, { force: true });
    release();
  }
}
