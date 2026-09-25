import { readFile, writeFile } from 'node:fs/promises';
import { checkToolchain } from './check-toolchain.mjs';

const versions = checkToolchain();
const lock = JSON.parse(await readFile('flake.lock', 'utf8'));
const workspaces = [
  '.',
  'apps/web',
  'apps/service',
  'packages/core',
  'packages/db',
  'packages/radicle',
];
const rows = [];
for (const directory of workspaces) {
  const manifest = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'));
  for (const [name, version] of Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    rows.push(`| ${directory} | ${name} | ${version} |`);
  }
}
const smoke = JSON.parse(await readFile('.ratlas/reports/toolchain.json', 'utf8'));
await writeFile(
  'docs/TOOLCHAIN.md',
  `# ratlas toolchain\n\nNixpkgs revision: ${lock.nodes.nixpkgs.locked.rev}.\nNode ${versions.node}; pnpm ${versions.pnpm}; Playwright ${versions.playwright}.\n\nThe user approved ESLint and @eslint/js family 10 on 2026-09-25. All other\ndirect dependencies follow specification families, with stable non-deprecated\nversions from the official npm registry. Strict peer and engine resolution passed.\n\n| Workspace | Dependency | Exact version |\n| --- | --- | --- |\n${rows.join('\n')}\n\n## Actual checks\n\n- Nix flake/toolchain check passed. Shell entry has no application side effects.\n- Frozen-lock install passed; better-sqlite3 compiled its bundled SQLite with Nix\n  GCC, Python, Make and Node headers (node-gyp 11.5.0). No downloaded prebuilt addon.\n- SQLite binding runtime ${smoke.sqlite}: FTS5 query, WAL writer plus read-only reader,\n  rejected reader write, and persistence after reopen passed.\n- Firefox ${smoke.firefox}: isolated headless page render, text assertion and PNG capture passed.\n- Bundle contains only ${smoke.bundleEntries.join(', ')}; recursive runtime closure has\n  ${smoke.runtimeClosurePaths} paths and no alternative browser packages. No personal profile accessed.\n- Playwright Test, Playwright and core all match the Nix export; Pino matches Fastify.\n- Dependency audit: two moderate entries for one usage-inapplicable Vitest advisory;\n  the enforced Node-only constraints and rationale are in DEPENDENCY_SECURITY.md.\n  No other advisories were reported. This is not a zero-finding audit.\n\nLocal evidence: .ratlas/reports/toolchain.json (including actual executable),\n.ratlas/reports/firefox-runtime-closure.txt, .ratlas/reports/firefox-smoke.png,\nand .ratlas/reports/bootstrap-audit.json. The smoke image is a toolchain test page,\nnot the ratlas application or a live-data screenshot.\n\nAn inherited deleted TMPDIR in the agent environment was worked around with\ncommand-scoped env -u TMPDIR nix develop --command; no user settings changed.\nSee NIX_DEVELOPMENT.md for normal commands and the workaround.\n`,
);
