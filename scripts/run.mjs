import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const [command, ...args] = process.argv.slice(2);
if (
  process.env.RATLAS_DEV_PLATFORM === 'guix' &&
  ['doctor', 'test:e2e', 'benchmark:browser', 'check'].includes(command)
) {
  console.error(
    'Guix Firefox automation is not configured. See docs/GUIX_DEVELOPMENT.md; browser checks were not run.',
  );
  process.exit(2);
}
const pnpm = (...values) => execFileSync('pnpm', values, { stdio: 'inherit' });
const tsx = (file, ...values) => pnpm('exec', 'tsx', file, ...values);
const tsxWithGc = (file, ...values) =>
  execFileSync('node', ['--expose-gc', '--import', 'tsx', file, ...values], { stdio: 'inherit' });
const buildBackend = () => pnpm('exec', 'tsc', '-b');
const buildWeb = () => pnpm('--filter', '@ratlas/web', 'exec', 'vite', 'build');
const commands = {
  'format:check': () => {
    pnpm('exec', 'prettier', '--check', '.');
    execFileSync('nixfmt', ['--check', 'flake.nix', 'deploy/nixos/ratlas.nix'], {
      stdio: 'inherit',
    });
  },
  lint: () => {
    pnpm('exec', 'eslint', '.');
    tsx('scripts/check-browser-policy.ts');
    tsx('scripts/check-spec.ts');
  },
  typecheck: () => {
    buildBackend();
    pnpm('exec', 'tsc', '-p', 'apps/web/tsconfig.json');
    pnpm('exec', 'tsc', '-p', 'tsconfig.tools.json');
  },
  test: () => {
    buildBackend();
    pnpm('exec', 'vitest', 'run');
  },
  'test:e2e': () => {
    buildBackend();
    buildWeb();
    tsx('scripts/e2e.ts');
  },
  build: () => {
    buildBackend();
    buildWeb();
  },
  'coverage:report': () => {
    buildBackend();
    tsx('scripts/coverage-report.ts', ...args);
  },
  'config:init': () => {
    buildBackend();
    tsx('scripts/config-init.ts', ...args);
  },
  'source:probe': () => {
    buildBackend();
    tsx('scripts/source-probe.ts', ...args);
  },
  doctor: () => {
    buildBackend();
    tsx('scripts/doctor.ts', ...args);
  },
  'db:migrate': () => {
    buildBackend();
    tsx('scripts/prepare.ts', ...args);
  },
  'db:backup': () => {
    buildBackend();
    tsx('scripts/db-backup.ts', ...args);
  },
  'data:review': () => {
    buildBackend();
    tsx('scripts/data-review.ts', ...args);
  },
  'data:target': () => {
    buildBackend();
    tsxWithGc('scripts/target-demo.ts');
  },
  benchmark: () => {
    buildBackend();
    tsx('scripts/benchmark.ts', ...args);
  },
  'benchmark:browser': () => {
    buildBackend();
    buildWeb();
    tsx('scripts/browser-benchmark.ts');
  },
  'demo:scenario': () => {
    buildBackend();
    tsx('scripts/demo-scenario.ts', ...args);
  },
  'demo:reset': () => {
    buildBackend();
    if (args.length) tsxWithGc('scripts/demo-reset.ts', ...args);
    else tsx('scripts/demo-reset.ts');
  },
  collect: () => {
    buildBackend();
    tsx('apps/service/src/main-collector.ts', ...args);
  },
  'collect:once': () => {
    buildBackend();
    tsx('apps/service/src/main-collector.ts', '--once', ...args);
  },
  'test:live': () => {
    buildBackend();
    tsx('apps/service/src/main-collector.ts', '--duration-ms', '60000', ...args);
  },
  experiment: () => {
    buildBackend();
    tsx('scripts/experiment.ts', ...args);
  },
  check: () => {
    for (const name of ['format:check', 'lint', 'typecheck', 'test', 'test:e2e', 'build'])
      commands[name]();
  },
};
if (!(command in commands)) throw new Error(`Unknown development command: ${command}`);
if (
  args.length &&
  ![
    'doctor',
    'source:probe',
    'config:init',
    'coverage:report',
    'db:migrate',
    'db:backup',
    'collect',
    'collect:once',
    'test:live',
    'experiment',
    'data:review',
    'benchmark',
    'demo:scenario',
    'demo:reset',
  ].includes(command)
)
  throw new Error(`Unexpected arguments for ${command}`);
try {
  commands[command]();
} catch (error) {
  process.exitCode = error.status || 1;
}
