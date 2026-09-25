import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function checkTestExposure() {
  const config = readFileSync('vitest.config.ts', 'utf8');
  assert.match(config, /api:\s*false/u);
  assert.match(config, /browser:\s*\{\s*enabled:\s*false\s*\}/u);
  assert.match(config, /environment:\s*'node'/u);
  assert.match(config, /watch:\s*false/u);
  function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'dist', '.git', '.ratlas', '.cache'].includes(entry.name)) return [];
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  }
  for (const file of walk('.').filter((p) => /\.(?:[cm]?[jt]sx?|json)$/u.test(p))) {
    if (file.endsWith('check-audit.mjs')) continue;
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /(?:from\s*|import\s*\(|require\s*\()\s*['"]@vitest\/(?:mocker|browser)/u,
      file,
    );
    assert.doesNotMatch(text, /vitest\s+[^\n"']*--(?:api|browser|ui|watch)/u, file);
  }
}

export function assessAudit(report) {
  checkTestExposure();
  if (!report.metadata || !report.advisories || report.error)
    throw new Error('Invalid/incomplete audit report');
  const findings = Object.values(report.advisories);
  for (const finding of findings) {
    if (
      finding.url !== 'https://github.com/advisories/GHSA-82fw-gwwq-j7x9' ||
      !['vitest', '@vitest/mocker'].includes(finding.module_name)
    ) {
      throw new Error(`Unreviewed dependency advisory: ${finding.url}`);
    }
  }
  return {
    findings: findings.length,
    applicable: 0,
    assessment:
      'GHSA-82fw-gwwq-j7x9: affected plugin/browser entry points absent; Node-only test constraints checked. See docs/DEPENDENCY_SECURITY.md.',
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(
    assessAudit(JSON.parse(readFileSync('.ratlas/reports/bootstrap-audit.json', 'utf8'))),
  );
}
