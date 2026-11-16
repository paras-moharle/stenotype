import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// All Better Auth endpoints live under /api/auth/*:
//   POST /api/auth/sign-in/email
//   POST /api/auth/sign-out
//   GET  /api/auth/get-session
//   ...and the admin plugin endpoints.
export const { GET, POST } = toNextJsHandler(auth.handler);

