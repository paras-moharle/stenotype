export function setting(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function capacityLevel(percent: number, thresholds = { warn: 50, urgent: 70, restrict: 80 }) {
  if (percent >= thresholds.restrict) return 'restricted';
  if (percent >= thresholds.urgent) return 'urgent';
  if (percent >= thresholds.warn) return 'warning';
  return 'normal';
}

export function readCapacityPolicy(env: Record<string, string | undefined>) {
  const defaults = { warn: 50, urgent: 70, restrict: 80 };
  const thresholds = {
    warn: setting(env.DB_CAPACITY_WARN_PERCENT, 50, 1, 99),
    urgent: setting(env.DB_CAPACITY_URGENT_PERCENT, 70, 1, 99),
    restrict: setting(env.DB_CAPACITY_RESTRICT_PERCENT, 80, 1, 99),
  };
  return {
    thresholds: thresholds.warn < thresholds.urgent && thresholds.urgent < thresholds.restrict
      ? thresholds : defaults,
    budget: setting(env.DB_STORAGE_BUDGET_BYTES, 1_000_000_000, 1, Number.MAX_SAFE_INTEGER),
    projectPercent: setting(env.DB_PROJECT_USAGE_PERCENT, 0, 0, 100),
    cacheMs: setting(env.DB_CAPACITY_SAMPLE_SECONDS, 300, 30, 3_600) * 1_000,
  };
}
