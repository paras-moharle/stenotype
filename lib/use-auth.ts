'use client';

/**
 * Backwards-compatible re-export. The auth state now lives in a
 * single root-level <AuthProvider> (see ./auth-provider) so that
 * /api/me is fetched once for the whole app instead of once per
 * component instance. Existing `import { useAuth } from
 * '@/lib/use-auth'` call sites keep working unchanged.
 */
export { AuthProvider, useAuth, type AppUser } from './auth-provider';

