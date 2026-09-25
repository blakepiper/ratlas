import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema, syntheticRid, syntheticNid } from '@ratlas/core';
import { openWriter, migrate, registerSource, observe, summary } from '@ratlas/db';
import { Collector } from './runtime.js';
it('starts its subscriber and completes the initial one-shot snapshot without overwriting a racing event', async () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const dir = resolve(mkdtempSync('.ratlas/tests/cli-runtime-'));
  const rid = syntheticRid(new Uint8Array(20).fill(9)),
    nid = syntheticNid(new Uint8Array(32).fill(9));
  const executable = resolve(dir, 'fixture.mjs');
  writeFileSync(
    executable,
    '#!' +
      process.execPath +
      '\n' +
      `
 import {writeFileSync,existsSync} from 'node:fs';
 const args=process.argv.slice(2).join(' ');
 if(args==='--version') console.log('rad fixture');
 else if(args==='self --help')console.log('--home');
 else if(args==='node --help')console.log('events routing status');
 else if(args==='node status --help')console.log('--only nid');
 else if(args==='node routing --help')console.log('--json');
 else if(args==='node events --help')console.log('events');
 else if(args==='self --home')console.log(process.env.RAD_HOME);
 else if(args==='node status --only nid')console.log(${JSON.stringify(nid)});
 else if(args==='node events'){
  writeFileSync(process.env.RAD_HOME+'/subscriber.pid',String(process.pid));
  const timer=setInterval(()=>{if(existsSync(process.env.RAD_HOME+'/snapshot.started')){console.log(${JSON.stringify(JSON.stringify({ type: 'seedDropped', rid, nid }))});clearInterval(timer);}},5);
  setInterval(()=>{},1000);
 } else if(args==='node routing --json'){
  writeFileSync(process.env.RAD_HOME+'/snapshot.started','yes');
  console.log(${JSON.stringify(JSON.stringify({ rid, nid }))});
  setTimeout(()=>{},150);
 } else process.exitCode=9;
 `,
    { mode: 0o700 },
  );
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: dir + '/ratlas.sqlite' },
    radicle: { enabled: true, executablePath: executable, homePath: dir },
    localObserverPublication: 'public-only-observer',
  });
  const writer = openWriter(config.storage.databasePath);
  const at = Date.now();
  migrate(writer.db, 'live', at);
  registerSource(
    writer.db,
    sourceSchema.parse({
      id: 'local-observer',
      label: 'test',
      adapter: 'cli',
      policy: 'public-only-observer',
    }),
  );
  observe(writer.db, {
    id: 'before',
    sourceId: 'local-observer',
    rid,
    nid,
    kind: 'present',
    observedAt: at,
  });
  const controller = new AbortController(),
    collector = new Collector(writer.db, config, controller.signal);
  try {
    await collector.run(true);
    expect(
      writer.db.prepare("SELECT COUNT(*) n FROM collector_runs WHERE status='success'").get(),
    ).toEqual({ n: 1 });
    expect(summary(writer.db).hostingRelationships).toBe(0);
    expect(summary(writer.db, 'all').hostingRelationships).toBe(1);
    expect(writer.db.prepare('SELECT reconciliation_status FROM collector_runs').get()).toEqual({
      reconciliation_status: 'required',
    });
  } finally {
    controller.abort();
    await collector.close();
    writer.close();
  }
  const pid = Number(readFileSync(dir + '/subscriber.pid', 'utf8'));
  expect(() => process.kill(pid, 0)).toThrow();
});
