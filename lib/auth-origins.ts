export function exactOrigin(value: string | undefined): string | undefined {
  if (!value || value.includes('*')) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function developmentOrigins() {
  if (process.env.NODE_ENV !== 'development') return [];
  return (process.env.STENO_DEV_TRUSTED_ORIGINS ?? '').split(',')
    .map(value => exactOrigin(value.trim())).filter((value): value is string => Boolean(value));
}
