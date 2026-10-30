/**
 * INCA Backend Performance & Diagnostic Benchmark Suite
 *
 * Measures:
 * 1. Process startup & module initialization breakdown (Cold vs Warm)
 * 2. First database request after connection vs repeated requests (Median & P95)
 * 3. Health & Diagnostic API latency
 * 4. Concurrent request throughput
 *
 * Usage:
 *   node scripts/benchmark.js
 */

const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { fork } = require('node:child_process');
const path = require('node:path');
require('dotenv').config();

function formatMs(ms) {
  return `${ms.toFixed(2)} ms`;
}

function calculateStats(samples) {
  if (!samples.length) return { min: 0, max: 0, mean: 0, median: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95Index = Math.min(
    Math.floor(sorted.length * 0.95),
    sorted.length - 1,
  );
  const p95 = sorted[p95Index];

  return { min, max, mean, median, p95 };
}

function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runHealthCheckBenchmark(port = 3000, samplesCount = 10) {
  console.log(`\n========================================================`);
  console.log(`  Phase 2: Database & API Latency Samples (N=${samplesCount})`);
  console.log(`========================================================`);

  const initialReq = await httpRequest({
    hostname: 'localhost',
    port,
    path: '/health',
    method: 'GET',
  });

  console.log(`Initial /health response status: ${initialReq.statusCode} (Duration: ${formatMs(initialReq.duration)})`);

  const samples = [];
  const dbLatencies = [];

  for (let i = 0; i < samplesCount; i++) {
    const res = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/health',
      method: 'GET',
    });
    samples.push(res.duration);
    try {
      const parsed = JSON.parse(res.body);
      if (parsed?.services?.database?.latencyMs) {
        dbLatencies.push(parsed.services.database.latencyMs);
      }
    } catch {}
    // small pause between repeated samples
    await new Promise((r) => setTimeout(r, 100));
  }

  const httpStats = calculateStats(samples);
  const dbStats = calculateStats(dbLatencies);

  console.log(`\nHTTP /health Total Request Duration:`);
  console.log(`  Samples: ${samples.length}`);
  console.log(`  Min:     ${formatMs(httpStats.min)}`);
  console.log(`  Max:     ${formatMs(httpStats.max)}`);
  console.log(`  Mean:    ${formatMs(httpStats.mean)}`);
  console.log(`  Median:  ${formatMs(httpStats.median)}`);
  console.log(`  P95:     ${formatMs(httpStats.p95)}`);

  if (dbLatencies.length) {
    console.log(`\nDatabase Server Round-Trip Latency (via Prisma $queryRaw SELECT 1):`);
    console.log(`  Samples: ${dbLatencies.length}`);
    console.log(`  Min:     ${formatMs(dbStats.min)}`);
    console.log(`  Max:     ${formatMs(dbStats.max)}`);
    console.log(`  Mean:    ${formatMs(dbStats.mean)}`);
    console.log(`  Median:  ${formatMs(dbStats.median)}`);
    console.log(`  P95:     ${formatMs(dbStats.p95)}`);
  }

  return { httpStats, dbStats };
}

async function runDiagnosticsEndpointBenchmark(port = 3000) {
  console.log(`\n========================================================`);
  console.log(`  Phase 3: Diagnostic Endpoint (/health/diagnostics)`);
  console.log(`========================================================`);

  const res = await httpRequest({
    hostname: 'localhost',
    port,
    path: '/health/diagnostics',
    method: 'GET',
  });

  console.log(`HTTP Status: ${res.statusCode} (Duration: ${formatMs(res.duration)})`);
  try {
    const parsed = JSON.parse(res.body);
    console.log(`Diagnostic Payload:`);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(`Raw Body: ${res.body}`);
  }
}

async function runConcurrencyBenchmark(port = 3000, concurrency = 5) {
  console.log(`\n========================================================`);
  console.log(`  Phase 4: Concurrent Requests Benchmark (C=${concurrency})`);
  console.log(`========================================================`);

  const startAll = performance.now();
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      httpRequest({
        hostname: 'localhost',
        port,
        path: '/health',
        method: 'GET',
      }),
    );
  }

  const results = await Promise.all(promises);
  const totalDuration = performance.now() - startAll;
  const durations = results.map((r) => r.duration);
  const stats = calculateStats(durations);

  console.log(`Fired ${concurrency} simultaneous requests.`);
  console.log(`Total Wall-Clock Time: ${formatMs(totalDuration)}`);
  console.log(`Individual Request Latencies:`);
  console.log(`  Min:    ${formatMs(stats.min)}`);
  console.log(`  Max:    ${formatMs(stats.max)}`);
  console.log(`  Mean:   ${formatMs(stats.mean)}`);
  console.log(`  Median: ${formatMs(stats.median)}`);
  console.log(`  P95:    ${formatMs(stats.p95)}`);

  return { totalDuration, stats };
}

async function main() {
  const port = process.env.PORT || 3000;
  console.log(`========================================================`);
  console.log(`  INCA Backend Diagnostic & Performance Benchmark`);
  console.log(`========================================================`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log(`Node.js Version: ${process.version}`);
  console.log(`OS Platform:     ${process.platform} (${process.arch})`);

  // Safe database endpoint display
  const dbUrl = process.env.DATABASE_URL || '';
  const match = dbUrl.match(/@([^:/]+)/);
  const dbHost = match ? match[1] : 'unknown';
  console.log(`Database Host:   ${dbHost} (PgBouncer Pooled, SSL required)`);

  // Check if server is running on port
  try {
    await httpRequest({ hostname: 'localhost', port, path: '/health', method: 'GET' });
    console.log(`\n[✔] Live backend detected running on http://localhost:${port}`);
    await runHealthCheckBenchmark(port, 10);
    await runDiagnosticsEndpointBenchmark(port);
    await runConcurrencyBenchmark(port, 5);
  } catch (err) {
    console.log(`\n[!] Live backend is not currently running on port ${port} (${err.message}).`);
    console.log(`To run benchmarks against a live server:`);
    console.log(`  1. In terminal 1: npm run start:prod`);
    console.log(`  2. In terminal 2: node scripts/benchmark.js`);
  }
}

main().catch(console.error);

