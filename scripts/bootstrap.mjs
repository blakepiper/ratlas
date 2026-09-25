import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { checkToolchain } from './check-toolchain.mjs';
import { assessAudit } from './check-audit.mjs';

// One-time bootstrap. Family choices come from specification §3.1.
const versions = checkToolchain();
process.umask(0o077);
const root = new URL('../', import.meta.url);
process.chdir(root.pathname);
try {
  await access('pnpm-lock.yaml');
  throw new Error(
    'Dependency lock already exists. Use pnpm install --frozen-lockfile. Dependency updates require explicit approval.',
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const metadata = new Map();
async function registry(name) {
  if (!metadata.has(name)) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error(`Registry lookup failed: ${name} ${response.status}`);
    metadata.set(name, await response.json());
  }
  return metadata.get(name);
}
const compare = (a, b) => {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
};
async function resolve(name, family) {
  const packument = await registry(name);
  const candidates = Object.keys(packument.versions)
    .filter(
      (v) =>
        /^\d+\.\d+\.\d+$/u.test(v) &&
        v.startsWith(`${family}.`) &&
        !packument.versions[v].deprecated,
    )
    .sort(compare);
  const selected = candidates.at(-1);
  if (!selected) throw new Error(`No non-deprecated stable ${name} ${family} version.`);
  return selected;
}
async function resolveFastifyPlugin(name, minimumMajor) {
  const packument = await registry(name);
  // Official plugin compatibility tables currently declare >= this major for Fastify 5.
  // Fail for review if that contract changes rather than guessing compatibility.
  const escaped = String(minimumMajor);
  if (!packument.readme?.includes(`>=${escaped}.x`)) {
    throw new Error(`Recheck the official Fastify 5 compatibility table for ${name}.`);
  }
  const selected = Object.keys(packument.versions)
    .filter(
      (v) =>
        /^\d+\.\d+\.\d+$/u.test(v) &&
        Number(v.split('.')[0]) >= minimumMajor &&
        !packument.versions[v].deprecated,
    )
    .sort(compare)
    .at(-1);
  if (!selected) throw new Error(`No compatible stable ${name} version.`);
  return selected;
}
async function deps(spec) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(spec).map(async ([name, family]) => [name, await resolve(name, family)]),
    ),
  );
}
const fastifyVersion = await resolve('fastify', '5');
const pinoRange = (await registry('fastify')).versions[fastifyVersion].dependencies.pino;
const pinoMajor = /^\^(\d+)\./u.exec(pinoRange)?.[1];
if (!pinoMajor) throw new Error(`Review unsupported Fastify Pino constraint: ${pinoRange}`);
const playwright = versions.playwright;
if (!/^\d+\.\d+\.\d+$/u.test(playwright)) throw new Error('Invalid Nix Playwright version.');

const manifests = {
  '.': {
    name: 'ratlas',
    packageManager: `pnpm@${versions.pnpm}`,
    engines: { node: versions.node, pnpm: versions.pnpm },
    scripts: {
      preinstall: 'node scripts/check-toolchain.mjs',
      postinstall: 'node scripts/build-native.mjs',
      'toolchain:check': 'node scripts/check-toolchain.mjs',
    },
    devDependencies: {
      ...(await deps({
        typescript: '5.9',
        tsx: '4',
        vitest: '3',
        eslint: '10',
        '@eslint/js': '10',
        'typescript-eslint': '8',
        prettier: '3',
        'node-gyp': '11',
        '@types/node': '24',
        '@testing-library/react': '16',
        '@testing-library/dom': '10',
        '@types/better-sqlite3': '7',
        '@types/react': '19',
        '@types/react-dom': '19',
      })),
      '@playwright/test': playwright,
    },
  },
  'apps/web': {
    name: '@ratlas/web',
    dependencies: {
      '@ratlas/core': 'workspace:*',
      ...(await deps({
        react: '19',
        'react-dom': '19',
        'react-router': '7',
        '@tanstack/react-query': '5',
        sigma: '3',
        graphology: '0.26',
        'graphology-layout-forceatlas2': '0.10',
      })),
    },
    devDependencies: await deps({ vite: '7', '@vitejs/plugin-react': '5' }),
  },
  'apps/service': {
    name: '@ratlas/service',
    dependencies: {
      '@ratlas/core': 'workspace:*',
      '@ratlas/db': 'workspace:*',
      '@ratlas/radicle': 'workspace:*',
      fastify: fastifyVersion,
      ...(await deps({ pino: pinoMajor, undici: '7' })),
      '@fastify/helmet': await resolveFastifyPlugin('@fastify/helmet', 12),
      '@fastify/rate-limit': await resolveFastifyPlugin('@fastify/rate-limit', 10),
      '@fastify/static': await resolveFastifyPlugin('@fastify/static', 8),
    },
  },
  'packages/core': {
    name: '@ratlas/core',
    dependencies: await deps({ zod: '4', multiformats: '13' }),
  },
  'packages/db': {
    name: '@ratlas/db',
    dependencies: { '@ratlas/core': 'workspace:*', 'better-sqlite3': '13.0.3' },
  },
  'packages/radicle': {
    name: '@ratlas/radicle',
    dependencies: {
      '@ratlas/core': 'workspace:*',
      ...(await deps({ undici: '7', 'ipaddr.js': '2' })),
    },
  },
};
if (manifests['apps/web'].dependencies.react !== manifests['apps/web'].dependencies['react-dom'])
  throw new Error('React/React DOM mismatch.');

await mkdir('.ratlas/reports', { recursive: true, mode: 0o700 });
for (const [directory, manifest] of Object.entries(manifests)) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/package.json`,
    `${JSON.stringify({ ...manifest, private: true, version: '0.0.0', type: 'module' }, null, 2)}\n`,
  );
}
// Peer and engine compatibility are checked by pnpm's strict workspace settings.
execFileSync('pnpm', ['install', '--lockfile-only'], { stdio: 'inherit' });
let audit;
try {
  audit = execFileSync('pnpm', ['audit', '--json'], { encoding: 'utf8' });
} catch (error) {
  if (error.status !== 1 || !error.stdout) throw error;
  audit = error.stdout;
}
await writeFile('.ratlas/reports/bootstrap-audit.json', audit, { mode: 0o600 });
console.log(assessAudit(JSON.parse(audit)));
execFileSync('pnpm', ['install', '--frozen-lockfile'], { stdio: 'inherit' });
const lock = JSON.parse(await readFile('flake.lock', 'utf8'));
const rows = Object.entries(manifests).flatMap(([directory, manifest]) =>
  Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).map(
    ([name, version]) => `| ${directory} | ${name} | ${version} |`,
  ),
);
await writeFile(
  'docs/TOOLCHAIN.md',
  `# ratlas toolchain\n\nNixpkgs revision: ${lock.nodes.nixpkgs.locked.rev}\n\nNode ${versions.node}; pnpm ${versions.pnpm}; Playwright ${playwright}.\n\nDirect dependencies resolved from the official npm registry within specification families; prereleases and deprecated versions excluded. Strict peer/engine checks and npm advisory audit run at bootstrap.\n\n| Workspace | Dependency | Exact version |\n| --- | --- | --- |\n${rows.join('\n')}\n\nNative SQLite and Firefox runtime results: pending.\n`,
);
console.log('ratlas exact dependency bootstrap complete. Use frozen installs from now on.');
