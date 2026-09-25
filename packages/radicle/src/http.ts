import { Client } from 'undici';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Config } from '@ratlas/core';
import { nidSchema, ridSchema } from '@ratlas/core';
import { AdapterError } from './errors.js';
import { parseHttpCatalog, parseHttpInventory, parseHttpNode, parseHttpRepo } from './schemas.js';

export function publicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress())
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
const resolveHost: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });
export async function resolvePublic(hostname: string, resolver: Resolver = resolveHost) {
  const host = hostname.replace(/^\[|\]$/gu, '');
  if (host.endsWith('.onion') || host.includes('%')) throw new AdapterError('unsafe-address');
  const answers = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolver(host);
  if (!answers.length || answers.some((answer) => !publicAddress(answer.address)))
    throw new AdapterError('unsafe-address');
  return answers[0]!;
}
export interface JsonTransport {
  get(path: string, signal: AbortSignal): Promise<unknown>;
}
export class HttpTransport implements JsonTransport {
  private readonly base: URL;
  constructor(
    baseUrl: string,
    private readonly limits: Pick<Config['collection'], 'requestTimeoutMs' | 'responseMaxBytes'>,
    private readonly decodedBytes: (count: number) => void = () => {},
  ) {
    this.base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    if (
      this.base.protocol !== 'https:' ||
      this.base.username ||
      this.base.password ||
      this.base.hash ||
      this.base.search
    )
      throw new AdapterError('unsafe-address');
  }
  async get(path: string, signal: AbortSignal): Promise<unknown> {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname))
      throw new AdapterError('unsafe-address');
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(this.limits.requestTimeoutMs)]);
    // A fresh connection validates and pins the actual lookup; the hostname remains TLS SNI.
    const host = url.hostname.replace(/^\[|\]$/gu, '');
    if (isIP(host)) await resolvePublic(host);
    const client = new Client(url.origin, {
      pipelining: 0,
      maxResponseSize: this.limits.responseMaxBytes,
      headersTimeout: this.limits.requestTimeoutMs,
      bodyTimeout: this.limits.requestTimeoutMs,
      connect: {
        timeout: this.limits.requestTimeoutMs,
        lookup: (hostname, _options, callback) => {
          resolvePublic(hostname).then(
            (answer) => callback(null, answer.address, answer.family),
            () => callback(new AdapterError('unsafe-address'), '', 4),
          );
        },
      },
    });
    try {
      // Client has no redirect interceptor; every 3xx is rejected below.
      const response = await client.request({
        path: url.pathname + url.search,
        method: 'GET',
        signal: bounded,
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate, br',
          'user-agent': 'ratlas/0.0.0',
        },
      });
      try {
        if (response.statusCode >= 300 && response.statusCode < 400)
          throw new AdapterError('redirect');
        const retry = response.headers['retry-after'];
        if (response.statusCode === 429 || response.statusCode >= 500)
          throw new AdapterError(
            'http-retryable',
            typeof retry === 'string' ? retry.slice(0, 128) : null,
          );
        if (response.statusCode === 404) throw new AdapterError('http-not-found');
        if (response.statusCode !== 200) throw new AdapterError('http-error');
        if (
          !/^application\/(?:[a-z.+-]*\+)?json(?:;|$)/iu.test(
            String(response.headers['content-type']),
          )
        )
          throw new AdapterError('unsupported-schema');
        const encoding = response.headers['content-encoding'];
        const decoder =
          encoding === 'gzip'
            ? createGunzip()
            : encoding === 'br'
              ? createBrotliDecompress()
              : encoding === 'deflate'
                ? createInflate()
                : null;
        if (encoding && encoding !== 'identity' && !decoder)
          throw new AdapterError('unsupported-schema');
        const stream = decoder ? response.body.pipe(decoder) : response.body;
        // pipe does not forward source errors automatically.
        const sourceError = (error: Error) => decoder?.destroy(error);
        response.body.on('error', sourceError);
        try {
          let size = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            const bytes = Buffer.from(chunk as Uint8Array);
            size += bytes.length;
            this.decodedBytes(bytes.length);
            if (size > this.limits.responseMaxBytes) throw new AdapterError('body-limit');
            chunks.push(bytes);
          }
          try {
            return JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
            );
          } catch {
            throw new AdapterError('invalid-json');
          }
        } finally {
          response.body.off('error', sourceError);
          decoder?.destroy();
        }
      } finally {
        response.body.destroy();
      }
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      if (bounded.aborted) throw new AdapterError(signal.aborted ? 'aborted' : 'timeout');
      throw new AdapterError('http-retryable');
    } finally {
      await client.destroy();
    }
  }
}
export class HttpAdapter {
  constructor(private readonly transport: JsonTransport) {}
  async node(signal: AbortSignal, expectedNid: string | null = null) {
    const value = parseHttpNode(await this.transport.get('node', signal));
    if (expectedNid && value.id !== expectedNid) throw new AdapterError('observer-mismatch');
    return value;
  }
  async inventory(nid: string, signal: AbortSignal, rowLimit?: number) {
    return parseHttpInventory(
      await this.transport.get(
        'nodes/' + encodeURIComponent(nidSchema.parse(nid)) + '/inventory',
        signal,
      ),
      rowLimit,
    );
  }
  async repo(rid: string, signal: AbortSignal) {
    const value = parseHttpRepo(
      await this.transport.get('repos/' + encodeURIComponent(ridSchema.parse(rid)), signal),
    );
    if (value.rid !== rid) throw new AdapterError('unsupported-schema');
    return value;
  }
  async *catalog(signal: AbortSignal, maxPages: number) {
    const seen = new Set<string>();
    for (let page = 0; page < maxPages; page++) {
      const rows = parseHttpCatalog(
        await this.transport.get('repos?show=all&page=' + page + '&perPage=100', signal),
      );
      // An empty extra page confirms termination even when a deployment silently caps page size.
      if (!rows.length) return;
      let newRows = 0;
      for (const row of rows) {
        if (seen.has(row.rid)) continue;
        newRows++;
        seen.add(row.rid);
        yield row;
      }
      if (!newRows) throw new AdapterError('repeated-page');
    }
    throw new AdapterError('page-limit');
  }
}
