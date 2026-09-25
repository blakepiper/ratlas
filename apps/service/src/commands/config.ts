import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { configSchema, type Config } from '@ratlas/core';

export const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export function configPath(explicit?: string): string {
  return resolve(projectRoot, explicit ?? process.env.RATLAS_CONFIG ?? 'config/ratlas.local.json');
}
export function loadConfig(explicit?: string): Config {
  let text: string;
  try {
    text = readFileSync(configPath(explicit), 'utf8');
  } catch (cause) {
    throw new Error(
      'Configuration unavailable. Copy config/ratlas.example.json to config/ratlas.local.json and edit it, or run pnpm demo.',
      { cause },
    );
  }
  const config = configSchema.parse(JSON.parse(text));
  const databasePath = resolve(projectRoot, config.storage.databasePath);
  if (databasePath.startsWith('/nix/store/'))
    throw new Error('Database path must be outside /nix/store');
  return {
    ...config,
    storage: { ...config.storage, databasePath },
    logging: { ...config.logging, directory: resolve(projectRoot, config.logging.directory) },
  };
}
export function configArguments() {
  return parseArgs({
    options: { config: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }).values;
}
