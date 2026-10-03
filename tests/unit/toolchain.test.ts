import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('development commands fail clearly without the shell marker', () => {
  const env = { ...process.env };
  delete env.RATLAS_DEV_SHELL;
  for (const args of [
    ['scripts/run.mjs', 'typecheck'],
    ['scripts/dev.mjs', 'demo'],
  ]) {
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('./ratlas-env');
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

it('rejects a mismatched runtime before running a development command', () => {
  const result = spawnSync(process.execPath, ['scripts/run.mjs', 'build'], {
    env: { ...process.env, RATLAS_NODE_VERSION: '0.0.0' },
    encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Node version differs');
});

it('refuses a corrupt cached tool archive before extraction or network access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ratlas-toolchain-'));
  try {
    mkdirSync(join(directory, 'scripts'));
    mkdirSync(join(directory, '.ratlas/toolchain'), { recursive: true });
    writeFileSync(
      join(directory, 'scripts/bootstrap-toolchain.py'),
      readFileSync('scripts/bootstrap-toolchain.py'),
    );
    writeFileSync(join(directory, 'toolchain.json'), readFileSync('toolchain.json'));
    const archive = join(directory, '.ratlas/toolchain/node-24.18.0.tar');
    writeFileSync(archive, 'damaged archive');
    const result = spawnSync(
      process.env.npm_config_python ?? 'python3',
      [join(directory, 'scripts/bootstrap-toolchain.py')],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('node archive checksum mismatch');
    expect(result.stdout).not.toContain('Downloading');
    expect(readFileSync(archive, 'utf8')).toBe('damaged archive');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
