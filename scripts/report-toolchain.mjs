import { readFile, writeFile } from 'node:fs/promises';
import { checkToolchain } from './check-toolchain.mjs';

const versions = checkToolchain();
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
  }))
    rows.push(`| ${directory} | ${name} | ${version} |`);
}
const smoke = JSON.parse(await readFile('.ratlas/reports/toolchain.json', 'utf8'));
if (
  smoke.node !== versions.node ||
  smoke.pnpm !== versions.pnpm ||
  smoke.playwright !== versions.playwright ||
  smoke.platform !== process.env.RATLAS_DEV_PLATFORM
)
  throw new Error('Run the doctor in this environment before generating its toolchain report.');
await writeFile(
  '.ratlas/reports/toolchain.md',
  `# ratlas toolchain\n\nPlatform: ${smoke.platform}. Node ${versions.node}; pnpm ${versions.pnpm}; Playwright ${versions.playwright}.\n\n| Workspace | Dependency | Exact version |\n| --- | --- | --- |\n${rows.join('\n')}\n\n## Actual doctor checks\n\n- SQLite ${smoke.sqlite}: ${smoke.sqliteChecks}.\n- Firefox ${smoke.firefox}: ${smoke.browserChecks}.\n- Browser bundle: ${smoke.bundleEntries.join(', ')}.\n\nEvidence: .ratlas/reports/toolchain.json and .ratlas/reports/firefox-smoke.png.\nThis report does not establish an install, dependency audit or live-source check.\n`,
  { mode: 0o600 },
);
