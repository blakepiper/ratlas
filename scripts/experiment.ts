import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../apps/service/src/commands/config.js';
import { runExperiment } from '../apps/service/src/collector/experiment.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
const { values } = parseArgs({
  options: { config: { type: 'string' }, duration: { type: 'string' } },
  strict: true,
  allowPositionals: false,
});
if (values.duration !== '24h') throw new Error('The supported experiment duration is 24h');
const config = loadConfig(values.config);
if (config.mode !== 'live') throw new Error('The observation experiment requires live mode');
if (!config.radicle.enabled && !config.httpSources.some((source) => source.enabled)) {
  console.error('Experiment not run: no approved enabled source is configured');
  process.exit(2);
}
process.umask(0o077);
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const result = await runExperiment(config, {
    directory: resolve('.ratlas/reports/experiment'),
    durationMs: 86400000,
    signal: controller.signal,
  });
  console.log(
    JSON.stringify({
      status: result.report.status,
      completedMs: result.report.completedMs,
      report: '.ratlas/reports/experiment/last-run.json',
    }),
  );
  process.exitCode = result.exitCode;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
