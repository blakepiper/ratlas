import { backupBeforeMigration } from '../apps/service/src/commands/migration-backup.js';
import { checkToolchain } from './check-toolchain.mjs';
import { configArguments, loadConfig } from '../apps/service/src/commands/config.js';
import { prepareDatabase } from '../apps/service/src/commands/prepare.js';

checkToolchain();
const config = loadConfig(configArguments().config);
await backupBeforeMigration(config);
prepareDatabase(config);
console.log('ratlas database schema ready; preparation connection closed');
