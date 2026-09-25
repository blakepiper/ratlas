import { parseArgs } from 'node:util';
import { configPath, loadConfig } from '../apps/service/src/commands/config.js';
import { backupDatabase } from '../packages/db/src/backup.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
const { values } = parseArgs({
  options: { config: { type: 'string' }, output: { type: 'string' } },
  strict: true,
  allowPositionals: false,
});
if (!values.output) throw new Error('Pass --output PATH for a new backup file');
const config = loadConfig(values.config);
const result = await backupDatabase(config.storage.databasePath, values.output);
console.log(JSON.stringify({ config: configPath(values.config), ...result }, null, 2));
