import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

it('development commands fail clearly without the shell marker', () => {
  const env = { ...process.env };
  delete env.RATLAS_DEV_SHELL;
  for (const args of [
    ['scripts/run.mjs', 'typecheck'],
    ['scripts/dev.mjs', 'demo'],
  ]) {
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('nix develop');
  }
});
it('demo rejects an explicit live config before starting any process', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/dev.mjs', 'demo', '--config', 'config/ratlas.example.json'],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Unknown option');
});
