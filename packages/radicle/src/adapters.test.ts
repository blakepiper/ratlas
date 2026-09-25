import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, syntheticRid, syntheticNid } from '@ratlas/core';
import { ndjson } from './ndjson.js';
import { parseEvent, parseHttpRepo, parseHttpInventory, parseRoute } from './schemas.js';
import { HttpAdapter, HttpTransport, publicAddress, resolvePublic } from './http.js';
import { radicleEnvironment, routingSnapshot, eventStream } from './cli.js';
const rid = syntheticRid(new Uint8Array(20).fill(1));
const nid = syntheticNid(new Uint8Array(32).fill(2));
const item = {
  rid,
  payloads: {
    'xyz.radicle.project': {
      data: { name: 'café <script>', description: 'plain text', defaultBranch: 'main' },
    },
  },
  delegates: [{ id: 'did:key:' + nid }],
  visibility: { type: 'public' },
  seeding: 999,
};
async function* bytes(parts: Buffer[]) {
  yield* parts;
}
async function collect(input: AsyncIterable<unknown>) {
  const values = [];
  for await (const v of input) values.push(v);
  return values;
}
function fakeCli(program: string) {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  const dir = mkdtempSync(resolve('.ratlas/tests/cli-'));
  const path = resolve(dir, 'fixture.mjs');
  writeFileSync(path, '#!' + process.execPath + '\n' + program, { mode: 0o700 });
  return configSchema.parse({
    mode: 'live',
    storage: { databasePath: dir + '/db.sqlite' },
    radicle: { enabled: true, executablePath: path, homePath: dir },
  });
}
describe('pinned read-only adapters', () => {
  it('frames every UTF-8 split, CRLF, blanks, multi-line chunks and final line', async () => {
    const buffer = Buffer.from('\n' + JSON.stringify(item) + '\r\n' + JSON.stringify({ rid, nid }));
    for (let index = 1; index < buffer.length; index++) {
      expect(
        await collect(
          ndjson(bytes([buffer.subarray(0, index), buffer.subarray(index)]), { lineBytes: 4096 }),
        ),
      ).toEqual([item, { rid, nid }]);
    }
  });
  it('enforces line, total, row and invalid UTF-8/JSON limits', async () => {
    for (const [data, limits, kind] of [
      ['x'.repeat(33), { lineBytes: 32 }, 'line-limit'],
      ['{}\n{}', { lineBytes: 100, totalBytes: 4 }, 'snapshot-limit'],
      ['{}\n{}', { lineBytes: 100, rows: 1 }, 'snapshot-limit'],
      ['not json', { lineBytes: 100 }, 'invalid-json'],
    ] as const)
      await expect(collect(ndjson(bytes([Buffer.from(data)]), limits))).rejects.toMatchObject({
        kind,
      });
    await expect(
      collect(ndjson(bytes([Buffer.from([34, 255, 34])]), { lineBytes: 100 })),
    ).rejects.toMatchObject({ kind: 'invalid-json' });
  });
  it('recognizes the frozen shapes and ignores unknown events without retaining addresses', () => {
    expect(parseRoute({ rid, nid })).toEqual({ rid, nid });
    expect(parseEvent({ type: 'futureEvent', secret: 'ignored' })).toBeNull();
    expect(
      parseEvent({
        type: 'nodeAnnounced',
        nid,
        alias: 'test',
        timestamp: 123,
        addresses: ['private'],
      }),
    ).not.toHaveProperty('addresses');
    expect(() => parseEvent({ type: 'seedDiscovered', rid: 'bad', nid })).toThrow(
      'unsupported-schema',
    );
    expect(parseHttpRepo(item).name).toBe('café <script>');
    expect(parseHttpRepo({ ...item, payloads: {} }).name).toBeNull();
    expect(() =>
      parseHttpRepo({
        ...item,
        payloads: { 'xyz.radicle.project': { name: 'unreviewed old shape' } },
      }),
    ).toThrow('unsupported-schema');
    expect(() => parseHttpInventory({ items: [rid] })).toThrow('unsupported-schema');
  });
  it('requests show=all and an empty tail; repeated/capped pages are partial errors', async () => {
    const calls: string[] = [];
    const adapter = new HttpAdapter({
      get: async (path) => {
        calls.push(path);
        return calls.length === 1 ? [item, item] : [];
      },
    });
    expect(await collect(adapter.catalog(new AbortController().signal, 3))).toHaveLength(1);
    expect(calls).toEqual([
      'repos?show=all&page=0&perPage=100',
      'repos?show=all&page=1&perPage=100',
    ]);
    const repeating = new HttpAdapter({ get: async () => [item] });
    await expect(collect(repeating.catalog(new AbortController().signal, 3))).rejects.toMatchObject(
      { kind: 'repeated-page' },
    );
    await expect(collect(repeating.catalog(new AbortController().signal, 1))).rejects.toMatchObject(
      { kind: 'page-limit' },
    );
  });
  it('rejects private/reserved/mapped addresses and mixed DNS answers', async () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.0.1',
      '169.254.169.254',
      '0.0.0.0',
      '224.0.0.1',
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      '100.64.0.1',
      '240.0.0.1',
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'ff02::1',
      '2001:db8::1',
      '::ffff:127.0.0.1',
    ])
      expect(publicAddress(address), address).toBe(false);
    expect(publicAddress('8.8.8.8')).toBe(true);
    await expect(
      resolvePublic('fixture.invalid', async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow('unsafe-address');
    expect(
      await resolvePublic('fixture.invalid', async () => [{ address: '8.8.8.8', family: 4 }]),
    ).toEqual({ address: '8.8.8.8', family: 4 });
    const transport = new HttpTransport('https://127.0.0.1/api/v1/', {
      requestTimeoutMs: 1000,
      responseMaxBytes: 1024,
    });
    await expect(transport.get('node', new AbortController().signal)).rejects.toThrow(
      'unsafe-address',
    );
    expect(
      () =>
        new HttpTransport('https://secret@example.org/', {
          requestTimeoutMs: 1000,
          responseMaxBytes: 1024,
        }),
    ).toThrow('unsafe-address');
  });
  it('owns only its CLI children, isolates environment and rejects partial process output', async () => {
    const config = fakeCli(
      'console.error("not json"); console.log(' +
        JSON.stringify(JSON.stringify({ rid, nid })) +
        ');',
    );
    expect(Object.keys(radicleEnvironment(config.radicle)).sort()).toEqual([
      'LANG',
      'LC_ALL',
      'RAD_HOME',
    ]);
    expect(await collect(routingSnapshot(config, new AbortController().signal))).toEqual([
      { rid, nid },
    ]);
    const failed = fakeCli(
      'console.log(' + JSON.stringify(JSON.stringify({ rid, nid })) + '); process.exitCode = 1;',
    );
    await expect(collect(routingSnapshot(failed, new AbortController().signal))).rejects.toThrow(
      'process-failed',
    );
    const streaming = fakeCli(
      'console.log(' +
        JSON.stringify(JSON.stringify({ type: 'seedDiscovered', rid, nid })) +
        '); setInterval(() => {}, 1000);',
    );
    const controller = new AbortController();
    const stream = eventStream(streaming, controller.signal);
    expect((await stream.next()).value).toMatchObject({ event: { type: 'seedDiscovered' } });
    controller.abort();
    await expect(stream.next()).rejects.toThrow('aborted');
  });
});
