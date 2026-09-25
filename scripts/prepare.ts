import { checkToolchain } from './check-toolchain.mjs';
import { configArguments, loadConfig } from '../apps/service/src/commands/config.js';
import { prepareDatabase } from '../apps/service/src/commands/prepare.js';

checkToolchain();
prepareDatabase(loadConfig(configArguments().config));
console.log('ratlas database schema ready; preparation connection closed');
