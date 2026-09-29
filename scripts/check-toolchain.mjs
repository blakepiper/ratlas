import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function checkToolchain() {
  if (process.env.RATLAS_DEV_SHELL !== '1') {
    throw new Error('Enter the ratlas development environment with ./ratlas-guix or nix develop.');
  }
  const pnpm = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  if (
    process.versions.node !== process.env.RATLAS_NODE_VERSION ||
    !process.versions.node.startsWith('24.')
  ) {
    throw new Error('Node version differs from the pinned development Node 24 runtime.');
  }
  if (
    pnpm !== process.env.RATLAS_PNPM_VERSION ||
    !/^10\./u.test(pnpm) ||
    Number(pnpm.split('.')[1]) < 26
  ) {
    throw new Error('Use the pinned development pnpm 10, at least 10.26.');
  }
  if (
    process.env.RATLAS_TEST_BROWSER !== 'firefox' ||
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD !== '1'
  ) {
    throw new Error('Use the repository Firefox-only development environment.');
  }
  return { node: process.versions.node, pnpm, playwright: process.env.RATLAS_PLAYWRIGHT_VERSION };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(checkToolchain()));
}
