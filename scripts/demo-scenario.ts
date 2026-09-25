import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema } from '../packages/core/dist/index.js';
import { openWriter, runDemoScenario, type DemoScenarioName } from '../packages/db/dist/index.js';
import { prepareDatabase } from '../apps/service/dist/commands/prepare.js';

const args = process.argv.slice(2);
if (
  args.length !== 2 ||
  args[0] !== '--name' ||
  (args[1] !== 'source-outage' && args[1] !== 'source-recovery')
)
  throw new Error('Usage: pnpm demo:scenario --name source-outage|source-recovery');

const databasePath = resolve('.ratlas/demo/ratlas.sqlite');
const config = configSchema.parse({ mode: 'demo', storage: { databasePath } });
prepareDatabase(config);
const writer = openWriter(databasePath);
let report: ReturnType<typeof runDemoScenario>;
try {
  report = runDemoScenario(writer.db, args[1] as DemoScenarioName, config.collection);
} finally {
  writer.close();
}
const directory = resolve('.ratlas/reviews/R5');
mkdirSync(directory, { recursive: true, mode: 0o700 });
if (report.injected.length)
  writeFileSync(
    resolve(directory, `${report.scenario}.json`),
    JSON.stringify(report, null, 2) + '\n',
    { mode: 0o600 },
  );
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
