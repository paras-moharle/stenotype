import { AsyncLocalStorage } from 'node:async_hooks';

export const signInSnapshot = new AsyncLocalStorage<{ id: string; updatedAt: number; role: string } | null>();
