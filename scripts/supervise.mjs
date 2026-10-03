import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Supervision requires a command');
const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
let interrupted = 0;
function signalGroup(signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    interrupted = code;
    signalGroup('SIGTERM');
  });
}
const result = await new Promise((resolve) => {
  child.once('error', (error) => {
    console.error(error.message);
    resolve(1);
  });
  child.once('close', (code) => resolve(code ?? 1));
});
if (interrupted && child.pid) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      process.kill(-child.pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') break;
      throw error;
    }
    await delay(100);
  }
  signalGroup('SIGKILL');
}
process.exitCode = interrupted || result;
