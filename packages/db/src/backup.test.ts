import { mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { backupDatabase } from './backup.js';
import { DEMO_REFERENCE, generateSmallDemo } from './demo.js';
import { migrate, openReader, openWriter } from './connection.js';
import { summary } from './queries.js';

const directory = mkdtempSync('.ratlas/tests/backup-');

it('backs up a live WAL database and restores its schema and counts', async () => {
  const source = resolve(directory, 'source.sqlite');
  const output = resolve(directory, 'backup.sqlite');
  const writer = openWriter(source);
  try {
    migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    generateSmallDemo(writer.db);
    const expected = summary(writer.db, 'all');
    const report = await backupDatabase(source, output);
    expect(report.counts).toEqual(expected);
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.sources).toBe(2);
    expect(report.observations).toBeGreaterThan(0);
    expect(readFileSync(output).subarray(0, 16).toString()).toBe('SQLite format 3\0');
    const restored = openReader(output);
    try {
      expect(summary(restored, 'all')).toEqual(expected);
    } finally {
      restored.close();
    }
    await expect(backupDatabase(source, output)).rejects.toThrow(/already exists/u);
  } finally {
    writer.close();
  }
});
