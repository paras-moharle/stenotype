import http from 'k6/http';
import { check, sleep } from 'k6';

/*
 * Public-journey load test.
 *
 * Deliberately read-only: it never signs in or submits an attempt.
 * Signing in is unsafe to load-test here because the app enforces a
 * single active session per user — concurrent logins would revoke each
 * other and measure the wrong thing.
 *
 * Run:
 *   BASE_URL=http://localhost:3100 \
 *     node_modules/.audit-tools/bin/k6 run scripts/audit/load.k6.js
 */

const BASE = __ENV.BASE_URL || 'http://localhost:3100';

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '15s', target: 25 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function publicJourney() {
  const home = http.get(`${BASE}/`);
  check(home, { 'home 200': (r) => r.status === 200 });

  const login = http.get(`${BASE}/login`);
  check(login, { 'login 200': (r) => r.status === 200 });

  const about = http.get(`${BASE}/about`);
  check(about, { 'about 200': (r) => r.status === 200 });

  // 401 is the correct unauthenticated answer; the route must not leak
  // transcripts or return a 500 under load. Tell k6 that 401 is expected,
  // otherwise it counts a healthy auth rejection as a failed request.
  const dictations = http.get(`${BASE}/api/dictations`, {
    responseCallback: http.expectedStatuses(200, 401),
  });
  check(dictations, {
    'dictations 401 or 200': (r) => r.status === 401 || r.status === 200,
  });

  sleep(0.3);
}
