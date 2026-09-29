import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { configSchema, z } from '../packages/core/dist/index.js';

const { values } = parseArgs({
  options: {
    preset: { type: 'string', default: 'public-v1' },
    output: { type: 'string', default: 'config/ratlas.local.json' },
    mode: { type: 'string', default: 'refresh' },
    write: { type: 'boolean', default: false },
  },
  strict: true,
});
if (values.preset !== 'public-v1') throw new Error('Unknown reviewed preset');
if (!['refresh', 'continuous'].includes(values.mode!))
  throw new Error('Choose refresh or continuous');
const output = resolve(values.output!);
if (dirname(output) !== resolve('config') || !output.endsWith('.local.json'))
  throw new Error('Output must be an ignored config/*.local.json path');
if (existsSync(output)) throw new Error('Refusing to overwrite existing configuration');
const preset = z
  .object({
    version: z.literal('public-v1'),
    lastChecked: z.string(),
    sources: configSchema.shape.httpSources,
  })
  .parse(JSON.parse(readFileSync('config/presets/public-v1.json', 'utf8')));
const config = configSchema.parse({
  mode: 'live',
  storage: { databasePath: '.ratlas/live/ratlas.sqlite' },
  sourcePreset: { version: preset.version, lastChecked: preset.lastChecked },
  httpSources: preset.sources,
});
console.log(
  JSON.stringify(
    {
      output,
      preset: config.sourcePreset,
      endpoints: config.httpSources,
      budgets: config.collection,
      collectionMode: values.mode,
      startup: `./ratlas-guix bash scripts/start-production.sh ${values.output}${values.mode === 'continuous' ? ' --continuous' : ''}`,
      writing: values.write,
    },
    null,
    2,
  ),
);
if (values.write)
  writeFileSync(output, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
