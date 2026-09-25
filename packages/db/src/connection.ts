import type Database from 'better-sqlite3';
import { nativeDatabase } from './native.js';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLease } from './lease.js';

export type Db = Database.Database;
export const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
function migrations() {
  return readdirSync(migrationDirectory)
    .filter((n) => /^\d+_.+\.sql$/u.test(n))
    .sort()
    .map((name) => {
      const sql = readFileSync(resolve(migrationDirectory, name), 'utf8');
      return {
        number: Number(name.split('_')[0]),
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    });
}
export function schemaCurrent(db: Db): boolean {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='schema_migrations'").get()) return false;
  const applied = db
    .prepare('SELECT number,checksum FROM schema_migrations ORDER BY number')
    .all() as { number: number; checksum: string }[];
  const expected = migrations();
  for (const entry of applied) {
    if (expected.find((m) => m.number === entry.number)?.checksum !== entry.checksum)
      throw new Error('Migration checksum mismatch or newer schema');
  }
  return applied.length === expected.length;
}
export function migrate(
  db: Db,
  kind: 'live' | 'demo',
  now: number,
  reference: number | null = null,
) {
  db.exec(
    'CREATE VIRTUAL TABLE temp.fts_capability USING fts5(text); DROP TABLE temp.fts_capability;',
  );
  db.transaction(() => {
    db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (number INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at INTEGER NOT NULL)',
    );
    schemaCurrent(db);
    for (const migration of migrations()) {
      if (db.prepare('SELECT 1 FROM schema_migrations WHERE number=?').get(migration.number))
        continue;
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(
        migration.number,
        migration.checksum,
        now,
      );
    }
    db.prepare(
      'INSERT OR IGNORE INTO dataset_meta(id,schema_version,kind,created_at,retention_boundary,reference_time,generator_version) VALUES (1,?,?,?,?,?,?)',
    ).run(migrations().length, kind, now, now, reference, null);
    if ((db.prepare('SELECT kind FROM dataset_meta').get() as { kind: string }).kind !== kind)
      throw new Error('Dataset kind does not match configuration');
    db.prepare('UPDATE dataset_meta SET schema_version=? WHERE id=1').run(migrations().length);
  })();
}
export function openWriter(path: string): { db: Db; close: () => void } {
  process.umask(0o077);
  const absolute = resolve(path);
  if (absolute.startsWith('/nix/store/'))
    throw new Error('Database must be writable outside /nix/store');
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
  if (realpathSync(dirname(absolute)).startsWith('/nix/store/'))
    throw new Error('Database directory resolves into /nix/store');
  const release = acquireLease(absolute);
  let db: Db;
  try {
    db = nativeDatabase(absolute);
    chmodSync(absolute, 0o600);
    db.pragma('foreign_keys=ON');
    db.pragma('journal_mode=WAL');
    db.pragma('synchronous=NORMAL');
    db.pragma('busy_timeout=5000');
  } catch (error) {
    release();
    throw error;
  }
  return {
    db,
    close: () => {
      try {
        db.close();
      } finally {
        release();
      }
    },
  };
}
export function openReader(path: string, options: { allowMigration?: boolean } = {}): Db {
  const db = nativeDatabase(resolve(path), { readonly: true, fileMustExist: true });
  try {
    db.pragma('foreign_keys=ON');
    db.pragma('busy_timeout=5000');
    db.pragma('query_only=ON');
    if (!schemaCurrent(db) && !options.allowMigration)
      throw new Error('Database schema requires migration');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
