import { base58btc } from 'multiformats/bases/base58';
import { z } from 'zod';

function validEncoding(input: string, kind: 'repo' | 'node'): boolean {
  try {
    if (kind === 'repo' && !input.startsWith('rad:z')) return false;
    const encoded = kind === 'repo' ? input.slice(4) : input;
    if (!encoded.startsWith('z')) return false;
    const bytes = base58btc.decode(encoded);
    return (
      base58btc.encode(bytes) === encoded &&
      (kind === 'repo'
        ? bytes.length === 20
        : bytes.length === 34 && bytes[0] === 0xed && bytes[1] === 0x01)
    );
  } catch {
    return false;
  }
}

// Heartwood 341982110: RIDs are raw 20-byte Git OIDs, not multihash envelopes.
export const ridSchema = z
  .string()
  .max(64)
  .refine((v) => validEncoding(v, 'repo'), 'Invalid canonical RID');
export const nidSchema = z
  .string()
  .max(64)
  .refine((v) => validEncoding(v, 'node'), 'Invalid Ed25519 NID');
export function normalizeNid(input: string): string {
  return nidSchema.parse(input.startsWith('did:key:') ? input.slice(8) : input);
}
export function visualKey(kind: 'repo' | 'node', id: string): string {
  return kind + ':' + (kind === 'repo' ? ridSchema : nidSchema).parse(id);
}
export function syntheticRid(bytes: Uint8Array): string {
  return ridSchema.parse('rad:' + base58btc.encode(bytes));
}
export function syntheticNid(bytes: Uint8Array): string {
  return nidSchema.parse(base58btc.encode(new Uint8Array([0xed, 0x01, ...bytes])));
}
