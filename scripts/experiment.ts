import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { configPath, loadConfig } from '../apps/service/src/commands/config.js';
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
const directory = resolve('.ratlas/reports/experiment');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const statePath = resolve(directory, 'state.json');
const reportPath = resolve(directory, 'last-run.json');
const chosenConfig = configPath(values.config);
const totalMs = 24 * 60 * 60 * 1000;
type State = { config: string; durationMs: number; completedMs: number; startedAt: string };
const state: State = existsSync(statePath)
  ? (JSON.parse(readFileSync(statePath, 'utf8')) as State)
  : {
      config: chosenConfig,
      durationMs: totalMs,
      completedMs: 0,
      startedAt: new Date().toISOString(),
    };
if (
  state.config !== chosenConfig ||
  state.durationMs !== totalMs ||
  !Number.isSafeInteger(state.completedMs) ||
  state.completedMs < 0 ||
  state.completedMs >= totalMs
)
  throw new Error(
    'Experiment state belongs to another run or is complete; archive it before starting a new experiment',
  );
function save(path: string, value: unknown) {
  const temporary = resolve(directory, `.state-${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, path);
}
save(statePath, state);
const started = performance.now();
const initialCompleted = state.completedMs;
const child = spawn(
  process.execPath,
  [resolve('apps/service/dist/main-collector.js'), '--config', chosenConfig],
  { stdio: 'inherit' },
);
let interrupted = false;
let stoppedForDuration = false;
const stop = () => {
  interrupted = true;
  child.kill('SIGTERM');
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
const remainingMs = totalMs - state.completedMs;
const deadline = setTimeout(() => {
  stoppedForDuration = true;
  child.kill('SIGTERM');
}, remainingMs);
const progress = setInterval(() => {
  state.completedMs = Math.min(totalMs, initialCompleted + (performance.now() - started));
  save(statePath, state);
}, 60_000);
let code: number | null;
try {
  code = await new Promise<number | null>((done, fail) => {
    child.once('error', fail);
    child.once('exit', done);
  });
} finally {
  clearTimeout(deadline);
  clearInterval(progress);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
state.completedMs = Math.min(totalMs, initialCompleted + (performance.now() - started));
save(statePath, state);
const report = {
  startedAt: state.startedAt,
  stoppedAt: new Date().toISOString(),
  completedMs: Math.round(state.completedMs),
  targetMs: totalMs,
  status: stoppedForDuration ? 'completed' : interrupted ? 'interrupted' : 'collector-exited',
  collectorExitCode: code,
  note: 'Active collector runtime only; offline intervals between resumes are excluded.',
};
save(reportPath, report);
console.log(JSON.stringify(report));
if (!stoppedForDuration || code !== 0) process.exitCode = code === 2 ? 2 : 1;
