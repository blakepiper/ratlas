import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import config from '../playwright.config.js';

assert.equal(config.use?.browserName, 'firefox');
assert.deepEqual(
  config.projects?.map((project) => project.name),
  ['firefox-desktop', 'firefox-narrow'],
);
for (const project of config.projects ?? []) {
  assert.equal(project.use?.browserName, 'firefox');
  assert.equal(project.use?.channel, undefined);
  assert.equal(project.use?.isMobile, undefined);
}
assert.equal(config.use?.channel, undefined);
assert.equal(config.use?.launchOptions?.executablePath, undefined);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', '.git', '.cache', '.ratlas'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
for (const file of walk('.').filter((path) => /\.(?:[cm]?[jt]sx?|json)$/u.test(path))) {
  if (file.endsWith('check-browser-policy.ts') || file.endsWith('flake.lock')) continue;
  const content = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    content,
    /(?:chromium|webkit)\s*\.\s*(?:launch|connect)|(?:playwright\s+(?:install|install-deps|codegen|show-trace))|(?:puppeteer|cypress|electron)/iu,
    file,
  );
  for (const match of content.matchAll(/browserName\s*:\s*['"]([^'"]+)['"]/gu))
    assert.equal(match[1], 'firefox', file);
  assert.doesNotMatch(
    content,
    /--browser(?:=|\s)|--channel(?:=|\s)|connectOverCDP|launchPersistentContext/iu,
    file,
  );
}
console.log('ratlas Firefox-only browser policy passed');
