import { parseArgs } from 'node:util';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../apps/service/src/commands/config.js';
import { coverageReport, renderCoverageMarkdown, openReader } from '../packages/db/dist/index.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    output: { type: 'string', default: '.ratlas/coverage/report' },
    at: { type: 'string' },
  },
  strict: true,
});
const output = resolve(values.output!);
if (!output.startsWith(resolve('.ratlas') + '/'))
  throw new Error('Generated reports must stay under ignored .ratlas/');
const config = loadConfig(values.config);
const at = values.at ? Date.parse(values.at) : Date.now();
if (!Number.isFinite(at)) throw new Error('Invalid UTC evaluation time');
const db = openReader(config.storage.databasePath);
try {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = coverageReport(db, config, at, revision);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output + '.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(output + '.md', renderCoverageMarkdown(report), { mode: 0o600 });
  console.log(renderCoverageMarkdown(report));
} finally {
  db.close();
}
