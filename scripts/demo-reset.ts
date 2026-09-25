import { resolve } from 'node:path';
import { resetDemoDataset } from '../packages/db/dist/index.js';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--dataset' || args[1] !== 'target'))
  throw new Error('Usage: pnpm demo:reset [--dataset target]');
const result = resetDemoDataset(resolve('.'), args.length ? 'target' : 'small');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
