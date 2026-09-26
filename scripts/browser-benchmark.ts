import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { firefox, type Locator, type Page } from '@playwright/test';
import { configSchema } from '../packages/core/src/index.js';
import { dataset, openReader } from '../packages/db/src/index.js';
import { createApi } from '../apps/service/src/api/server.js';
import { checkToolchain } from './check-toolchain.mjs';
import { firefoxLaunchEnvironment } from './firefox-env.js';

async function measureWebglInteraction(page: Page, map: Locator) {
  const canvas = map.locator('[data-graph-renderer="webgl"] canvas').first();
  const bounds = await canvas.boundingBox();
  if (!bounds) return null;
  // Let the bounded initial layout settle before measuring pointer interaction.
  await page.waitForTimeout(5200);
  const instrumented = (await page.evaluate(`(() => {
    const canvas = document.querySelector('[data-graph-renderer="webgl"] canvas');
    const gl = canvas && (canvas.getContext('webgl') || canvas.getContext('webgl2'));
    if (!gl) return false;
    const original = {};
    const probe = { draws: 0, activeFrames: 0, frames: 0, lastDraws: 0,
      startedAt: performance.now(), elapsedMs: 0, done: false, original, gl };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (typeof gl[name] !== 'function') continue;
      original[name] = gl[name];
      gl[name] = function (...args) { probe.draws++; return original[name].apply(this, args); };
    }
    if (!Object.keys(original).length) return false;
    window.__ratlasFrameProbe = probe;
    function tick(at) {
      probe.frames++;
      if (probe.draws > probe.lastDraws) probe.activeFrames++;
      probe.lastDraws = probe.draws;
      probe.elapsedMs = at - probe.startedAt;
      if (probe.elapsedMs < 1800) requestAnimationFrame(tick);
      else probe.done = true;
    }
    requestAnimationFrame(tick);
    return true;
  })()`)) as boolean;
  if (!instrumented) return null;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, i % 2 ? 18 : -18);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return (await page.evaluate(`(async () => {
    const probe = window.__ratlasFrameProbe;
    while (!probe.done) await new Promise(resolve => setTimeout(resolve, 20));
    for (const [name, original] of Object.entries(probe.original)) probe.gl[name] = original;
    delete window.__ratlasFrameProbe;
    return { elapsedMs: probe.elapsedMs, drawCalls: probe.draws,
      animationFrames: probe.frames, drawActiveFrames: probe.activeFrames,
      drawActiveFps: probe.activeFrames * 1000 / probe.elapsedMs };
  })()`)) as {
    elapsedMs: number;
    drawCalls: number;
    animationFrames: number;
    drawActiveFrames: number;
    drawActiveFps: number;
  };
}

checkToolchain();
const databasePath = resolve('.ratlas/demo/target.sqlite');
const reader = openReader(databasePath);
try {
  if (dataset(reader).kind !== 'demo' || dataset(reader).generator_version !== 2)
    throw new Error('Prepare the target synthetic dataset before browser benchmarking');
} finally {
  reader.close();
}
let browser: Awaited<ReturnType<typeof firefox.launch>> | undefined;
const samples = [];
try {
  const launchStart = performance.now();
  browser = await firefox.launch({ headless: true, env: firefoxLaunchEnvironment() });
  const launchMs = performance.now() - launchStart;
  mkdirSync('.ratlas/reviews/R6', { recursive: true, mode: 0o700 });
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'narrow', width: 390, height: 844 },
  ]) {
    // Give each viewport a fresh API cache so both "first" samples are cold.
    const app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath } }), {
      production: true,
      rateLimitMax: 100000,
    });
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    try {
      context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'en-US',
        timezoneId: 'UTC',
      });
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      const page = await context.newPage();
      for (const condition of ['first', 'warm'] as const) {
        let graphDataAt: number | null = null;
        const onRequestFinished = (request: { url: () => string }) => {
          if (new URL(request.url()).pathname === '/api/v1/graph' && graphDataAt === null)
            graphDataAt = performance.now();
        };
        page.on('requestfinished', onRequestFinished);
        const started = performance.now();
        await page.goto(address, { waitUntil: 'domcontentloaded' });
        const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
        if (viewport.width <= 1023) {
          await tabs.waitFor({ state: 'visible' });
          await tabs.getByRole('button', { name: 'Map' }).click();
        }
        const map = page.getByRole('region', { name: 'Relationship map' });
        await map
          .locator('[data-graph-renderer="webgl"], [data-graph-renderer="fallback"]')
          .waitFor({
            state: 'visible',
            timeout: 60000,
          });
        const elapsedMs = performance.now() - started;
        page.off('requestfinished', onRequestFinished);
        const dataToVisibleMs = graphDataAt === null ? null : performance.now() - graphDataAt;
        const renderer = await map
          .locator('[data-graph-renderer]')
          .getAttribute('data-graph-renderer');
        const webglInfo =
          renderer === 'webgl'
            ? await page.evaluate(() => {
                for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
                  '[data-graph-renderer="webgl"] canvas',
                )) {
                  const gl = canvas.getContext('webgl') ?? canvas.getContext('webgl2');
                  if (!gl) continue;
                  const debug = gl.getExtension('WEBGL_debug_renderer_info');
                  return {
                    vendor: String(gl.getParameter(gl.VENDOR)),
                    renderer: String(
                      gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
                    ),
                    classification: 'unknown' as const,
                  };
                }
                return null;
              })
            : null;
        const countText = await map.locator('[class*=counts]').innerText();
        if (condition === 'first')
          await page.screenshot({
            path: `.ratlas/reviews/R6/target-${viewport.name}-${renderer}.png`,
          });
        const interaction =
          condition === 'first' && renderer === 'webgl'
            ? await measureWebglInteraction(page, map)
            : null;
        samples.push({
          viewport: viewport.name,
          condition,
          elapsedMs,
          dataToVisibleMs,
          renderer,
          webglInfo,
          interaction,
          countText,
        });
        console.log(`${viewport.name} ${condition}: ${Math.round(elapsedMs)} ms, ${renderer}`);
      }
    } finally {
      await context?.close();
      await app.close();
    }
  }
  const report = {
    measuredAt: new Date().toISOString(),
    host: { architecture: process.arch, cpu: cpus()[0]?.model },
    browser: { engine: 'firefox', version: browser.version(), launchMs },
    workload:
      'Synthetic target dataset (20000 repositories, 2000 nodes, 100000 hosting relationships)',
    note: 'Each viewport uses a fresh API cache for its first navigation, then repeats with that same cache. Navigation-to-visible-map timing includes page, API, and render work. Data-to-visible starts when Playwright observes completion of the first graph API response body and ends when the canvas element becomes visible; it includes browser parsing and scheduling. Interaction FPS is a browser-level proxy: animation frames containing instrumented WebGL draw calls during repeated wheel input after initial layout; it is not GPU presentation timing. WebGL renderer strings may be privacy-masked and do not establish hardware/software classification.',
    samples,
  };
  mkdirSync('.ratlas/reports', { recursive: true, mode: 0o700 });
  writeFileSync('.ratlas/reports/browser-benchmark.json', JSON.stringify(report, null, 2) + '\n', {
    mode: 0o600,
  });
} finally {
  await browser?.close();
}
