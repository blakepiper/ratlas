export type FailureKind =
  | 'unsupported-schema'
  | 'invalid-json'
  | 'line-limit'
  | 'snapshot-limit'
  | 'process-failed'
  | 'timeout'
  | 'aborted'
  | 'unsupported-cli'
  | 'unsafe-address'
  | 'redirect'
  | 'http-not-found'
  | 'http-retryable'
  | 'http-error'
  | 'body-limit'
  | 'repeated-page'
  | 'page-limit'
  | 'observer-mismatch';
export class AdapterError extends Error {
  constructor(
    public readonly kind: FailureKind,
    public readonly retryAfter: string | null = null,
  ) {
    super(kind);
    this.name = 'AdapterError';
  }
}
export function failureKind(error: unknown): FailureKind {
  return error instanceof AdapterError ? error.kind : 'process-failed';
}
