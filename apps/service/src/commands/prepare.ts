import { existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { type Config } from '@ratlas/core';
import {
  dataset,
  DEMO_REFERENCE,
  generateSmallDemo,
  migrate,
  openReader,
  openWriter,
  schemaCurrent,
} from '@ratlas/db';
import { projectRoot } from './config.js';

export function prepareDatabase(config: Config, root = projectRoot) {
  const path = config.storage.databasePath;
  let existing = path;
  while (!existsSync(existing)) existing = dirname(existing);
  const canonical = resolve(realpathSync(existing), relative(existing, path));
  if (canonical.startsWith('/nix/store/')) throw new Error('Database resolves into /nix/store');
  const smallDemoPath = resolve(root, '.ratlas/demo/ratlas.sqlite');
  const targetDemoPath = resolve(root, '.ratlas/demo/target.sqlite');
  if (config.mode === 'demo') {
    if ((path !== smallDemoPath && path !== targetDemoPath) || canonical !== path)
      throw new Error('Demo requires its dedicated canonical database path');
    if (path === targetDemoPath && !existsSync(path))
      throw new Error('Generate the target demo first with pnpm data:target');
  }
  if (existsSync(path)) {
    const reader = openReader(path, { allowMigration: true });
    try {
      const meta = dataset(reader);
      if (meta.kind !== config.mode)
        throw new Error('Existing database kind does not match configuration');
      if (meta.kind === 'demo' && meta.generator_version !== (path === targetDemoPath ? 2 : 1))
        throw new Error('Demo generator version mismatch; explicit reset required');
      if (schemaCurrent(reader)) return;
    } finally {
      reader.close();
    }
  }
  const writer = openWriter(path);
  try {
    writer.db.transaction(() => {
      migrate(
        writer.db,
        config.mode,
        config.mode === 'demo' ? DEMO_REFERENCE : Date.now(),
        config.mode === 'demo' ? DEMO_REFERENCE : null,
      );
      if (config.mode === 'demo' && dataset(writer.db).generator_version === null)
        generateSmallDemo(writer.db);
    })();
  } finally {
    writer.close();
  }
}
