import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { dataset, summary } from './queries.js';
import { openReader, schemaCurrent } from './connection.js';

export async function backupDatabase(source: string, output: string) {
  process.umask(0o077);
  const sourcePath = resolve(source);
  const outputPath = resolve(output);
  if (sourcePath === outputPath || outputPath.startsWith('/nix/store/'))
    throw new Error('Backup output must be distinct and outside /nix/store');
  if (existsSync(outputPath)) throw new Error('Backup output already exists');
  const directory = dirname(outputPath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory).startsWith('/nix/store/'))
    throw new Error('Backup directory resolves into /nix/store');
  const temporary = resolve(directory, `.backup-${randomUUID()}.sqlite`);
  const reader = openReader(sourcePath);
  try {
    await reader.backup(temporary);
    chmodSync(temporary, 0o600);
    const restored = openReader(temporary);
    try {
      const checks = restored.pragma('quick_check') as { quick_check: string }[];
      if (checks.length !== 1 || checks[0]?.quick_check !== 'ok')
        throw new Error('Backup failed SQLite quick_check');
      if (!schemaCurrent(restored)) throw new Error('Backup schema is not current');
      const counts = summary(restored, 'all');
      const sourceCounts = {
        sources: (
          restored.prepare('SELECT COUNT(*) AS count FROM sources').get() as { count: number }
        ).count,
        observations: (
          restored.prepare('SELECT COUNT(*) AS count FROM observations').get() as { count: number }
        ).count,
      };
      if (dataset(restored).kind !== dataset(reader).kind)
        throw new Error('Backup dataset kind changed');
      linkSync(temporary, outputPath);
      return { output: outputPath, bytes: statSync(outputPath).size, counts, ...sourceCounts };
    } finally {
      restored.close();
    }
  } finally {
    reader.close();
    rmSync(temporary, { force: true });
  }
}
