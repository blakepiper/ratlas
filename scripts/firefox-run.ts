import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { firefoxLaunchEnvironment } from './firefox-env.js';

const [entry, ...args] = process.argv.slice(2);
if (
  !entry ||
  ![
    'scripts/doctor.ts',
    'scripts/e2e.ts',
    'scripts/browser-benchmark.ts',
    'scripts/coverage-browser.ts',
  ].includes(entry)
)
  throw new Error('Unknown Firefox command');
// Playwright's dependency validation runs before launch, in this process.
// Give only this browser command the same libraries as its Firefox child.
Object.assign(process.env, firefoxLaunchEnvironment());
process.argv = [process.execPath, resolve(entry), ...args];
await import(pathToFileURL(resolve(entry)).href);
