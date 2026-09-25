export function isStorageFailure(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'string' &&
    (code.startsWith('SQLITE_') || ['ENOSPC', 'EDQUOT', 'EIO', 'EBUSY', 'EROFS'].includes(code))
  );
}
