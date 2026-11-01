import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('Public deployment health endpoint', () => {
  let app: INestApplication;
  const db = { $queryRaw: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: db }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api', { exclude: ['health', 'health/(.*)'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    db.$queryRaw.mockReset().mockResolvedValue([{ value: 1 }]);
  });
  it('responds at /health without authentication and prevents stale caching', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      services: { database: { status: 'up' } },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it('reports database failures as 503 without leaking driver errors or credentials', async () => {
    db.$queryRaw.mockRejectedValue(new Error('private-database-password'));
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    expect(JSON.stringify(response.body)).not.toContain(
      'private-database-password',
    );
    expect(JSON.stringify(response.body)).toContain(
      'Database temporarily unreachable',
    );
  });
  it('supports HEAD checks used by HTTP uptime monitors', async () => {
    await request(app.getHttpServer()).head('/health').expect(200);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
