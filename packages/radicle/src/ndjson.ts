import { AdapterError } from './errors.js';

/** Byte-bounded framing; decoding only complete lines preserves split UTF-8. */
export async function* ndjson(
  chunks: AsyncIterable<Uint8Array>,
  limits: { lineBytes: number; totalBytes?: number; rows?: number },
) {
  let parts: Buffer[] = [],
    size = 0,
    total = 0,
    rows = 0;
  const decode = (buffer: Buffer): unknown => {
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    } catch {
      throw new AdapterError('invalid-json');
    }
  };
  for await (const input of chunks) {
    const chunk = Buffer.from(input);
    total += chunk.length;
    if (total > (limits.totalBytes ?? Infinity)) throw new AdapterError('snapshot-limit');
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      const piece = chunk.subarray(start, end);
      size += piece.length;
      if (size > limits.lineBytes) throw new AdapterError('line-limit');
      parts.push(piece);
      if (newline < 0) break;
      const line = Buffer.concat(parts, size);
      parts = [];
      size = 0;
      if (line.toString('utf8').trim()) {
        if (++rows > (limits.rows ?? Infinity)) throw new AdapterError('snapshot-limit');
        yield decode(line);
      }
      start = newline + 1;
    }
  }
  if (size) {
    const line = Buffer.concat(parts, size);
    if (line.toString('utf8').trim()) {
      if (rows + 1 > (limits.rows ?? Infinity)) throw new AdapterError('snapshot-limit');
      yield decode(line);
    }
  }
}
