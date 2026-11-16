'use client';

import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

// Browser-side Better Auth client. Used by the AuthProvider for
// session state, sign-in, and sign-out.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

