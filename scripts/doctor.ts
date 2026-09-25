import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { configPath, loadConfig } from '../apps/service/src/commands/config.js';
import { dataset, openReader } from '../packages/db/dist/index.js';
import { toolchainSmoke } from './toolchain-smoke.js';

const { values } = parseArgs({
  options: { config: { type: 'string' }, 'check-sources': { type: 'boolean', default: false } },
  strict: true,
  allowPositionals: false,
});
if (values['check-sources']) {
  console.error(
    'Source probing is not implemented in Stage A; R1 approval is required before Stage B. No source was contacted.',
  );
  process.exitCode = 2;
} else {
  await toolchainSmoke();
  if (!values.config && !process.env.RATLAS_CONFIG && !existsSync(configPath())) {
    console.log(
      'Live configuration: unconfigured (offline checks passed). Copy and edit config/ratlas.example.json when ready.',
    );
  } else {
    const config = loadConfig(values.config);
    console.log(
      `Configuration valid: mode=${config.mode}; local observer policy=${config.localObserverPublication}; live collection not started`,
    );
    if (existsSync(config.storage.databasePath)) {
      const db = openReader(config.storage.databasePath);
      try {
        if (dataset(db).kind !== config.mode) throw new Error('Configured database mode mismatch');
        console.log('Application database: readable, schema current, mode matches');
      } finally {
        db.close();
      }
    } else console.log('Application database: not initialized; doctor did not create it');
    if (config.radicle.enabled) {
      const executable = config.radicle.executablePath!;
      accessSync(executable, constants.X_OK);
      const env: NodeJS.ProcessEnv = { ...process.env, RAD_HOME: config.radicle.homePath! };
      delete env.RAD_SOCKET;
      if (config.radicle.socketPath) env.RAD_SOCKET = config.radicle.socketPath;
      for (const args of [
        ['--version'],
        ['self', '--help'],
        ['node', '--help'],
        ['node', 'status', '--help'],
        ['node', 'routing', '--help'],
      ]) {
        const result = spawnSync(executable, args, {
          env,
          encoding: 'utf8',
          timeout: 5000,
          maxBuffer: 1048576,
        });
        if (result.error || result.status !== 0)
          throw new Error(`Configured rad does not support ${args.join(' ')}`, {
            cause: result.error,
          });
        // Help only: never infer permission to query a personal profile or node.
        console.log(`Configured rad ${args.join(' ')}: supported`);
        if (args[0] === '--version') console.log(result.stdout.trim().slice(0, 200));
      }
      console.log(
        'Explicit observer paths configured. Identity/routing checks deferred to Stage B source probing.',
      );
    } else console.log('Radicle executable/profile: disabled; no personal profile accessed');
  }
}
