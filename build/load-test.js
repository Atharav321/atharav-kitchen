/**
 * ============================================================
 *  ATHARAV KITCHEN — Load Test (k6)
 *
 *  Install k6: https://k6.io/docs/get-started/installation/
 *
 *  Run smoke test (quick):
 *    npm run load-test:smoke
 *
 *  Run full load test:
 *    npm run load-test
 *
 *  Results: checks response time, error rate, availability
 * ============================================================
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const homepageTime = new Trend('homepage_duration');
const blogTime = new Trend('blog_duration');

// ── Test config ──────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users over 1 min
    { duration: '3m', target: 30 },   // Stay at 30 users for 3 mins
    { duration: '1m', target: 50 },   // Peak: 50 concurrent users
    { duration: '1m', target: 0  },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% requests under 3s
    'http_req_failed':   ['rate<0.01'],  // Less than 1% errors
    'errors':            ['rate<0.01'],
    'homepage_duration': ['p(95)<2000'], // Homepage under 2s
  },
};

const BASE_URL = 'https://atharav-kitchen.pages.dev';

const PAGES = [
  { url: '/',                                     name: 'Homepage',         weight: 60 },
  { url: '/blog.html',                            name: 'Blog List',        weight: 15 },
  { url: '/blog-best-cloud-kitchen-dhanbad.html', name: 'Blog: Best Cloud', weight: 10 },
  { url: '/blog-order-food-online-dhanbad.html',  name: 'Blog: Order Guide',weight: 10 },
  { url: '/sitemap.xml',                          name: 'Sitemap',          weight: 5  },
];

// ── Main test function ────────────────────────────────────────
export default function () {
  // Pick a random page based on weight (simulates real traffic mix)
  const rand = Math.random() * 100;
  let cumulative = 0;
  let page = PAGES[0];
  for (const p of PAGES) {
    cumulative += p.weight;
    if (rand < cumulative) { page = p; break; }
  }

  const res = http.get(BASE_URL + page.url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'k6-load-test/1.0 (Atharav Kitchen Performance Test)',
    },
  });

  // Track custom metrics
  if (page.name === 'Homepage') homepageTime.add(res.timings.duration);
  if (page.name.includes('Blog')) blogTime.add(res.timings.duration);

  // Assertions
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
    'has content': (r) => r.body && r.body.length > 1000,
    'no error page': (r) => !r.body.includes('500 Internal Server Error'),
  });

  errorRate.add(!ok);

  // Simulate real user think time (1-3 seconds between requests)
  sleep(1 + Math.random() * 2);
}

// ── Setup: verify site is up before load test ─────────────────
export function setup() {
  const res = http.get(BASE_URL + '/');
  if (res.status !== 200) {
    throw new Error(`Site is down! Status: ${res.status}. Fix before load testing.`);
  }
  console.log(`✅ Site is up (${res.timings.duration}ms). Starting load test...`);
}

// ── Teardown: print summary ───────────────────────────────────
export function teardown(data) {
  console.log('Load test complete. Check thresholds above.');
  console.log('Sentry dashboard pe bhi check karo — errors spike hua ya nahi.');
}
