import { db } from '@/lib/db';
import { capacityLevel, readCapacityPolicy } from '@/lib/db-operational-policy';

const policy = readCapacityPolicy(process.env);
let cached: { until: number; value: Awaited<ReturnType<typeof sample>> } | undefined;
let sampling: ReturnType<typeof sample> | undefined;

async function sample() {
  const [row] = await db.$queryRaw<{ bytes: bigint }[]>`
    SELECT pg_database_size(current_database()) AS bytes
  `;
  const bytes = Number(row.bytes);
  const percent = Math.max(100 * bytes / policy.budget, policy.projectPercent);
  return { bytes, percent, level: capacityLevel(percent, policy.thresholds) };
}

export async function getStorageCapacity() {
  if (cached && cached.until > Date.now()) return cached.value;
  sampling ??= sample().then((value) => {
    cached = { until: Date.now() + policy.cacheMs, value };
    return value;
  }).finally(() => { sampling = undefined; });
  return sampling;
}

export async function rejectStorageGrowth() {
  try {
    if ((await getStorageCapacity()).level !== 'restricted') return null;
  } catch {
    return Response.json({ error: 'Could not confirm storage capacity. Your changes were not saved. Please retry.' }, { status: 503 });
  }
  return Response.json({
    error: 'Database storage is near its limit. Your changes were not saved. Contact an administrator or retry later.',
  }, { status: 503 });
}
