const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(
      `http://localhost:3000${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const duration = performance.now() - start;
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (_) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            duration,
            body: json || body,
          });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('       INCA FINAL PERFORMANCE & REGRESSION TEST SUITE          ');
  console.log('===============================================================\n');

  // 1. Health Checks
  console.log('--- 1. Health & Diagnostics Checks ---');
  const healthRes = await request('/health');
  console.log(`GET /health: status=${healthRes.status}, latency=${healthRes.duration.toFixed(2)}ms, dbStatus=${healthRes.body?.services?.database?.status}`);
  
  const diagRes = await request('/health/diagnostics');
  console.log(`GET /health/diagnostics: status=${diagRes.status}, latency=${diagRes.duration.toFixed(2)}ms, uptime=${diagRes.body?.uptimeSeconds}s, heapUsedMb=${diagRes.body?.memory?.heapUsedMb}MB\n`);

  // 2. Swagger Docs Generation
  console.log('--- 2. Swagger Documentation ---');
  const docsRes = await request('/docs');
  console.log(`GET /docs (lazy generation): status=${docsRes.status}, latency=${docsRes.duration.toFixed(2)}ms\n`);

  // 3. Security Checks (Auth & RBAC)
  console.log('--- 3. Security & Permission Enforcement ---');
  const unauthAcademic = await request('/api/v1/academic/departments');
  console.log(`Unauthenticated GET /api/v1/academic/departments: status=${unauthAcademic.status} (Expected: 401 Unauthorized)`);
  
  const unauthReports = await request('/api/v1/reports/filter-options');
  console.log(`Unauthenticated GET /api/v1/reports/filter-options: status=${unauthReports.status} (Expected: 401 Unauthorized)`);
  
  const unauthPolls = await request('/api/v1/polls');
  console.log(`Unauthenticated GET /api/v1/polls: status=${unauthPolls.status} (Expected: 401 Unauthorized)`);

  const unauthStudent = await request('/api/v1/students');
  console.log(`Unauthenticated GET /api/v1/students: status=${unauthStudent.status} (Expected: 401 Unauthorized)`);

  // Verify diagnostic sanitization: no credentials leaked
  const diagString = JSON.stringify(diagRes.body);
  const leaksDbUrl = diagString.includes('postgresql://') || diagString.includes('ep-quiet-sun') || diagString.includes('neondb_owner');
  console.log(`Diagnostic endpoint leaks database credentials: ${leaksDbUrl ? 'FAIL (LEAK DETECTED)' : 'PASS (Clean & Sanitized)'}\n`);

  // 4. Authenticate to test protected endpoints and caching
  console.log('--- 4. Authentication & Protected Endpoint Performance ---');
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    {
      sub: '8420ec26-7655-4908-af3f-92b8fdc0d5f9',
      email: 'admin@bit.ac.in',
      role: 'SUPER_ADMIN',
    },
    process.env.JWT_SECRET || 'INCA-Akshhat',
    { expiresIn: '1h' }
  );
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('SuperAdmin JWT Session Established: token minted successfully.');

  // 5. Academic Data Caching Test
  console.log('\n--- 5. Targeted Caching Verification (Academic Reference Data) ---');
  
  // Call 1: Cache Miss (Database wire time)
  const deptMiss = await request('/api/v1/academic/departments', { headers: authHeaders });
  console.log(`GET /academic/departments (1st call - DB Miss): status=${deptMiss.status}, count=${deptMiss.body?.length}, latency=${deptMiss.duration.toFixed(2)}ms`);
  
  // Call 2: Cache Hit (In-memory instant)
  const deptHit = await request('/api/v1/academic/departments', { headers: authHeaders });
  console.log(`GET /academic/departments (2nd call - Memory Hit): status=${deptHit.status}, count=${deptHit.body?.length}, latency=${deptHit.duration.toFixed(2)}ms`);
  const deptSpeedup = ((deptMiss.duration - deptHit.duration) / deptMiss.duration * 100).toFixed(1);
  console.log(`=> Cache Hit Latency Improvement: ${deptSpeedup}% faster (${deptMiss.duration.toFixed(1)}ms -> ${deptHit.duration.toFixed(1)}ms)`);

  // Programs caching
  const progMiss = await request('/api/v1/academic/departments/programs', { headers: authHeaders });
  console.log(`GET /academic/departments/programs (1st call - DB Miss): status=${progMiss.status}, latency=${progMiss.duration.toFixed(2)}ms`);
  
  const progHit = await request('/api/v1/academic/departments/programs', { headers: authHeaders });
  console.log(`GET /academic/departments/programs (2nd call - Memory Hit): status=${progHit.status}, latency=${progHit.duration.toFixed(2)}ms`);

  // Polls Academic Scopes caching
  const scopesMiss = await request('/api/v1/polls/academic-scopes', { headers: authHeaders });
  console.log(`GET /polls/academic-scopes (1st call - DB Miss): status=${scopesMiss.status}, latency=${scopesMiss.duration.toFixed(2)}ms`);
  
  const scopesHit = await request('/api/v1/polls/academic-scopes', { headers: authHeaders });
  console.log(`GET /polls/academic-scopes (2nd call - Memory Hit): status=${scopesHit.status}, latency=${scopesHit.duration.toFixed(2)}ms`);

  // Reports Filter Options caching
  console.log('\n--- 6. Reports Filter Options Parallelized + Cached ---');
  const filtersMiss = await request('/api/v1/reports/filter-options', { headers: authHeaders });
  console.log(`GET /reports/filter-options (1st call - Parallel DB): status=${filtersMiss.status}, latency=${filtersMiss.duration.toFixed(2)}ms`);
  
  const filtersHit = await request('/api/v1/reports/filter-options', { headers: authHeaders });
  console.log(`GET /reports/filter-options (2nd call - Memory Hit): status=${filtersHit.status}, latency=${filtersHit.duration.toFixed(2)}ms`);

  // 7. Parallelized Dashboard Queries
  console.log('\n--- 7. SuperAdmin Stats Parallelized Query Performance ---');
  const superAdminRes = await request('/api/v1/super-admin/stats', { headers: authHeaders });
  console.log(`GET /super-admin/stats: status=${superAdminRes.status}, latency=${superAdminRes.duration.toFixed(2)}ms (Original baseline: 6,858ms)`);

  // 8. Concurrency & Connection Pool Load Testing
  console.log('\n--- 8. Concurrency & Connection Pool Load Test (20 concurrent requests) ---');
  const concurrency = 20;
  const requests = Array.from({ length: concurrency }, (_, i) => 
    request(i % 2 === 0 ? '/api/v1/academic/departments' : '/health', { headers: authHeaders })
  );

  const tLoadStart = performance.now();
  const loadResults = await Promise.all(requests);
  const tLoadTotal = performance.now() - tLoadStart;

  const latencies = loadResults.map(r => r.duration).sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const medianLatency = latencies[Math.floor(latencies.length / 2)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const errorCount = loadResults.filter(r => r.status >= 400).length;

  console.log(`Total Batch Time for ${concurrency} concurrent requests: ${tLoadTotal.toFixed(2)}ms`);
  console.log(`Min Latency: ${minLatency.toFixed(2)}ms`);
  console.log(`Median Latency: ${medianLatency.toFixed(2)}ms`);
  console.log(`p95 Latency: ${p95Latency.toFixed(2)}ms`);
  console.log(`Max Latency: ${maxLatency.toFixed(2)}ms`);
  console.log(`Errors: ${errorCount}/${concurrency} (${(errorCount / concurrency * 100).toFixed(1)}%)`);

  console.log('\n===============================================================');
  console.log('              ALL REGRESSION SUITES COMPLETED                  ');
  console.log('===============================================================');
}

run().catch(console.error);
