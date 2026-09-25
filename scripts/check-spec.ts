import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', '--show-toplevel'), resolve('.'));
for (const path of [
  'AGENTS.md',
  'RATLAS_IMPLEMENTATION_SPEC.md',
  'flake.nix',
  'flake.lock',
  'pnpm-lock.yaml',
  'package.json',
  'docs/CHECKPOINTS.md',
])
  git('ls-files', '--error-unmatch', path);
for (const path of [
  '.ratlas/demo/ratlas.sqlite',
  '.cache/pnpm/private',
  'config/ratlas.local.json',
  'apps/web/dist/index.html',
  'node_modules/example',
  '.env',
  'secret.sqlite-wal',
])
  assert.equal(git('check-ignore', path), path);
const document = readFileSync('docs/CHECKPOINTS.md', 'utf8');
const rows = document
  .split('\n')
  .filter((line) => /^\| R[1-6]\s*\|/u.test(line))
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((item) => item.trim()),
  );
assert.deepEqual(
  rows.map((row) => row[0]),
  ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
);
const statuses = [
  'pending',
  'in_progress',
  'awaiting_review',
  'changes_requested',
  'approved',
  'completed',
  'blocked',
];
assert.ok(rows.every((row) => statuses.includes(row[1]!)));
assert.ok(
  rows.filter((row) =>
    ['in_progress', 'awaiting_review', 'changes_requested', 'blocked'].includes(row[1]!),
  ).length <= 1,
);
for (const row of rows)
  if (['awaiting_review', 'approved', 'changes_requested', 'completed'].includes(row[1]!)) {
    const sha = row[2]!.replaceAll('`', '');
    assert.match(sha, /^[0-9a-f]{40}$/u);
    git('cat-file', '-e', `${sha}^{commit}`);
    assert.doesNotMatch(git('show', '-s', '--format=%s', sha), /^docs\(review\):/u);
  }
const status = readFileSync('docs/IMPLEMENTATION_STATUS.md', 'utf8');
if (/all checkpoints approved|release accepted/iu.test(status))
  assert.ok(rows.every((row) => row[1] === 'approved'));
const flake = readFileSync('flake.nix', 'utf8');
assert.doesNotMatch(flake, /shellHook\s*=/u);
const supervisor = readFileSync('scripts/dev.mjs', 'utf8');
assert.doesNotMatch(supervisor, /main-collector|collect:once|rad node start/u);
console.log('Read-only repository, ignore, review-state and shell/supervisor checks passed');
