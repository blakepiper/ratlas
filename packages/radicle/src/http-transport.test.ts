import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { Client } from 'undici';
import { HttpAdapter, readHttpJson } from './http.js';
import { readFileSync } from 'node:fs';
let server: Server, origin: string;
const requested: string[] = [];
const fixture = JSON.parse(readFileSync('fixtures/upstream/http-contract.json', 'utf8'));
beforeAll(async () => {
  server = createServer((request, response) => {
    requested.push(request.url!);
    response.setHeader('content-type', 'application/json');
    if (request.url === '/redirect') {
      response.statusCode = 302;
      response.setHeader('location', 'http://127.0.0.1/private');
      response.end();
    } else if (request.url === '/retry') {
      response.statusCode = 429;
      response.setHeader('retry-after', '60');
      response.end();
    } else if (request.url === '/failure') {
      response.statusCode = 503;
      response.end();
    } else if (request.url === '/missing') {
      response.statusCode = 404;
      response.end();
    } else if (request.url === '/html') {
      response.setHeader('content-type', 'text/html');
      response.end('<html>unrecognized</html>');
    } else if (request.url === '/bad-json') {
      response.end('{');
    } else if (request.url === '/bomb') {
      response.setHeader('content-encoding', 'gzip');
      response.end(gzipSync(JSON.stringify('x'.repeat(100000))));
    } else if (request.url === '/gzip') {
      response.setHeader('content-encoding', 'gzip');
      response.end(gzipSync(JSON.stringify(fixture.repo)));
    } else if (request.url === '/br') {
      response.setHeader('content-encoding', 'br');
      response.end(brotliCompressSync(JSON.stringify(fixture.repo)));
    } else if (request.url === '/node') response.end(JSON.stringify(fixture.node));
    else if (request.url?.includes('/inventory')) response.end(JSON.stringify(fixture.inventory));
    else response.end(JSON.stringify(fixture.repo));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server');
  origin = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => {
  server.close();
  await once(server, 'close');
});
// Only this test adapter accepts its explicitly created loopback origin. Production has no switch.
async function fixtureGet(
  path: string,
  maxBytes = 16384,
  onBytes: (count: number) => void = () => {},
) {
  const client = new Client(origin);
  try {
    return await readHttpJson(
      await client.request({ path, method: 'GET', signal: AbortSignal.timeout(1000) }),
      maxBytes,
      onBytes,
    );
  } finally {
    await client.destroy();
  }
}
it('exercises pinned fixtures through real loopback HTTP and attributes subject inventories', async () => {
  const adapter = new HttpAdapter({ get: (path) => fixtureGet('/' + path) });
  expect((await adapter.node(new AbortController().signal)).id).toBe(fixture.node.id);
  expect(await adapter.inventory(fixture.node.id, new AbortController().signal)).toEqual(
    fixture.inventory,
  );
  expect((await adapter.repo(fixture.repo.rid, new AbortController().signal)).rid).toBe(
    fixture.repo.rid,
  );
});
it('counts decoded gzip/brotli bytes and rejects decompression expansion', async () => {
  for (const path of ['/gzip', '/br']) {
    let bytes = 0;
    expect(
      await fixtureGet(path, 16384, (count) => {
        bytes += count;
      }),
    ).toEqual(fixture.repo);
    expect(bytes).toBe(Buffer.byteLength(JSON.stringify(fixture.repo)));
  }
  await expect(fixtureGet('/bomb', 1024)).rejects.toMatchObject({ kind: 'body-limit' });
});
it('rejects all redirects without following them and preserves bounded error categories', async () => {
  for (const [path, kind] of [
    ['/redirect', 'redirect'],
    ['/retry', 'http-retryable'],
    ['/failure', 'http-retryable'],
    ['/missing', 'http-not-found'],
    ['/html', 'unsupported-schema'],
    ['/bad-json', 'invalid-json'],
  ])
    await expect(fixtureGet(path!)).rejects.toMatchObject({ kind });
  expect(requested).not.toContain('/private');
  await expect(fixtureGet('/retry')).rejects.toMatchObject({ retryAfter: '60' });
});
