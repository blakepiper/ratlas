import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema, syntheticRid, syntheticNid } from '@ratlas/core';
import { openWriter, migrate, registerSource, observe, summary } from '@ratlas/db';
import { Collector } from './runtime.js';
import { enqueueEvent, independentlyPublicRepository } from '@ratlas/db';
import { applyPendingEvents } from './events.js';
import { observerEvent } from './observer-publication.js';

it('publishes only independently known public routing rows and filters mixed inventories before persistence and replay', async () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const dir = resolve(mkdtempSync('.ratlas/tests/public-routing-'));
  const rid = syntheticRid(new Uint8Array(20).fill(51)),
    privateRid = syntheticRid(new Uint8Array(20).fill(52)),
    nid = syntheticNid(new Uint8Array(32).fill(51)),
    privateNid = syntheticNid(new Uint8Array(32).fill(52));
  const executable = resolve(dir, 'fixture.mjs');
  writeFileSync(
    executable,
    '#!' +
      process.execPath +
      '\n' +
      `
const args=process.argv.slice(2).join(' ');
if(args==='--version')console.log('rad fixture');
else if(args==='self --help')console.log('--home');
else if(args==='node --help')console.log('routing status');
else if(args==='node routing --help')console.log('--json');
else if(args==='node status --help')console.log('--only nid');
else if(args==='self --home')console.log(process.env.RAD_HOME);
else if(args==='node status --only nid')console.log(${JSON.stringify(nid)});
else if(args==='node routing --json'){
 console.log(${JSON.stringify(JSON.stringify({ rid, nid }))});
 console.log(${JSON.stringify(JSON.stringify({ rid: privateRid, nid: privateNid }))});
}else process.exitCode=9;
`,
    { mode: 0o700 },
  );
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: dir + '/data.sqlite' },
    radicle: { enabled: true, executablePath: executable, homePath: dir },
    localObserverPublication: 'public-only-observer',
    localObserverPublicRepositoriesOnly: true,
  });
  const writer = openWriter(config.storage.databasePath),
    now = Date.now();
  migrate(writer.db, 'live', now);
  registerSource(
    writer.db,
    sourceSchema.parse({ id: 'public', label: 'public', adapter: 'http', policy: 'public-http' }),
  );
  observe(writer.db, {
    id: 'known-public',
    sourceId: 'public',
    rid,
    nid,
    kind: 'present',
    observedAt: now,
  });
  const controller = new AbortController(),
    collector = new Collector(writer.db, config, controller.signal);
  try {
    await collector.run(true);
    expect(
      writer.db
        .prepare("SELECT rid,nid FROM source_route_state WHERE source_id='local-observer'")
        .all(),
    ).toEqual([{ rid, nid }]);
    expect(
      writer.db.prepare('SELECT 1 FROM repositories WHERE rid=?').get(privateRid),
    ).toBeUndefined();
    expect(independentlyPublicRepository(writer.db, privateRid)).toBe(false);
    const event = {
      type: 'inventoryAnnounced' as const,
      nid,
      inventory: [rid, privateRid],
      timestamp: now,
    };
    expect(observerEvent(writer.db, config, event)).toMatchObject({ inventory: [rid] });
    expect(
      observerEvent(writer.db, config, {
        type: 'seedDiscovered',
        nid: privateNid,
        rid: privateRid,
      }),
    ).toBeNull();
    expect(
      observerEvent(writer.db, config, {
        type: 'nodeAnnounced',
        nid: privateNid,
        alias: 'private',
        timestamp: now,
      }),
    ).toBeNull();
    enqueueEvent(
      writer.db,
      {
        id: 'mixed',
        sourceId: 'local-observer',
        sessionId: 'fixture',
        sequence: 1,
        at: now,
        event,
      },
      100,
    );
    applyPendingEvents(writer.db, config);
    expect(
      writer.db.prepare('SELECT 1 FROM observations WHERE rid=?').get(privateRid),
    ).toBeUndefined();
    expect(writer.db.prepare('SELECT COUNT(*) n FROM collector_events').get()).toEqual({ n: 0 });
  } finally {
    controller.abort();
    await collector.close();
    writer.close();
  }
});
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
it('records EOF, reconnects a quiet subscriber and reconciles the gap without orphan children', async () => {
  const dir = resolve(mkdtempSync('.ratlas/tests/reconnect-'));
  const rid = syntheticRid(new Uint8Array(20).fill(10)),
    nid = syntheticNid(new Uint8Array(32).fill(10));
  const executable = resolve(dir, 'fixture.mjs');
  writeFileSync(
    executable,
    '#!' +
      process.execPath +
      '\n' +
      `
 import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
 const args=process.argv.slice(2).join(' '),base=process.env.RAD_HOME;
 if(args==='--version')console.log('rad fixture');
 else if(args==='self --help')console.log('--home');
 else if(args==='node --help')console.log('events routing status');
 else if(args==='node status --help')console.log('--only nid');
 else if(args==='node routing --help')console.log('--json');
 else if(args==='node events --help')console.log('events');
 else if(args==='self --home')console.log(base);
 else if(args==='node status --only nid')console.log(${JSON.stringify(nid)});
 else if(args==='node routing --json'){console.log(${JSON.stringify(JSON.stringify({ rid, nid }))});setTimeout(()=>{},150);}
 else if(args==='node events'){
  appendFileSync(base+'/pids',String(process.pid)+'\\n');
  if(!existsSync(base+'/first')){writeFileSync(base+'/first','yes');console.log('{"type":"futureEvent"}');setTimeout(()=>{},30);}
  else setInterval(()=>{},1000);
 }else process.exitCode=9;
 `,
    { mode: 0o700 },
  );
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: dir + '/ratlas.sqlite' },
    radicle: { enabled: true, executablePath: executable, homePath: dir },
    localObserverPublication: 'public-only-observer',
    collection: { reconnectDebounceMs: 1000 },
  });
  const writer = openWriter(config.storage.databasePath);
  migrate(writer.db, 'live', Date.now());
  const controller = new AbortController(),
    collector = new Collector(writer.db, config, controller.signal, { random: () => 0 });
  const timer = setTimeout(() => controller.abort(), 3200);
  try {
    await collector.run(false);
    await collector.close();
    expect(summary(writer.db).hostingRelationships).toBe(1);
    expect(writer.db.prepare('SELECT reason,ended_at FROM coverage_gaps').get()).toMatchObject({
      reason: 'event-stream-eof',
      ended_at: expect.any(Number),
    });
    expect(writer.db.prepare('SELECT unknown_event_count FROM source_health').get()).toEqual({
      unknown_event_count: 1,
    });
    expect(
      (writer.db.prepare('SELECT COUNT(*) n FROM collector_runs').get() as { n: number }).n,
    ).toBeGreaterThanOrEqual(2);
  } finally {
    clearTimeout(timer);
    controller.abort();
    await collector.close();
    writer.close();
  }
  const pids = readFileSync(dir + '/pids', 'utf8')
    .trim()
    .split('\n')
    .map(Number);
  expect(pids).toHaveLength(2);
  for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
}, 10000);
