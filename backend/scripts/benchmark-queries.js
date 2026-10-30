/**
 * Query Benchmark Suite - Measures latency of optimized dashboard & reporting endpoints
 */
const { NestFactory } = require('@nestjs/core');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const { AppModule } = require('../dist/app.module');
  const { SuperAdminService } = require('../dist/modules/super-admin/super-admin.service');
  const { ReportsService } = require('../dist/modules/reports/reports.service');
  const { PollsService } = require('../dist/modules/polls/polls.service');

  console.log('Bootstrapping application context for query benchmarking...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const superAdminService = app.get(SuperAdminService);
  const reportsService = app.get(ReportsService);
  const pollsService = app.get(PollsService);

  console.log('\n======================================================');
  console.log('  1. SuperAdminService.getStats() (Optimized with Promise.all)');
  console.log('======================================================');
  const statsSamples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = await superAdminService.getStats();
    const duration = performance.now() - start;
    statsSamples.push(duration);
    console.log(`Sample ${i + 1}: ${duration.toFixed(2)} ms (Depts: ${result.connectedDepartments.count}, ActiveUsers: ${result.totalActiveUsers.count})`);
  }

  console.log('\n======================================================');
  console.log('  2. ReportsService.getAdminDashboardSummary() (Optimized with Promise.all)');
  console.log('======================================================');
  const adminDashSamples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = await reportsService.getAdminDashboardSummary();
    const duration = performance.now() - start;
    adminDashSamples.push(duration);
    console.log(`Sample ${i + 1}: ${duration.toFixed(2)} ms (Students: ${result.data.activeStudentsCount}, Faculty: ${result.data.activeFacultyCount}, Shortfall: ${result.data.shortfallCount})`);
  }

  console.log('\n======================================================');
  console.log('  3. ReportsService.getCoordinatorDashboardSummary() (Optimized)');
  console.log('======================================================');
  const coordDashSamples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = await reportsService.getCoordinatorDashboardSummary();
    const duration = performance.now() - start;
    coordDashSamples.push(duration);
    console.log(`Sample ${i + 1}: ${duration.toFixed(2)} ms (Section: ${result.data?.section?.name || 'None'})`);
  }

  console.log('\n======================================================');
  console.log('  4. PollsService.getAcademicScopes() (Optimized with Promise.all)');
  console.log('======================================================');
  const scopesSamples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = await pollsService.getAcademicScopes();
    const duration = performance.now() - start;
    scopesSamples.push(duration);
    console.log(`Sample ${i + 1}: ${duration.toFixed(2)} ms (Depts: ${result.departments.length}, Programs: ${result.programs.length})`);
  }

  await app.close();
}

run().catch(console.error);

