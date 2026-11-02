import {
  ForbiddenException,
  INestApplication,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Readable } from 'stream';
import request from 'supertest';
import { assertPublicImageKey } from './public-image-policy';
import type { PublicImageScope } from './public-image-policy';
import { StrictR2StorageService } from './strict-r2-storage.service';
import { StorageController } from './storage.controller';
import { MarketplaceMediaController } from '../marketplace/marketplace-media.controller';
import { StudentController } from '../student/student.controller';
import { StudentRegistrationService } from '../student/student-registration.service';
import { StudentService } from '../student/student.service';
import { NoticesService } from '../notices/notices.service';
import { StudentRepository } from '../student/repositories/student.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('Public image key policy', () => {
  const scopes: PublicImageScope[] = ['campus', 'student', 'marketplace'];
  const deniedKeys = [
    'profile-requests/pending-photo.png',
    'learning-materials/private.pdf',
    'learning-materials/private.png',
    'notices/attachment.pdf',
    'notices/attachment.jpg',
    'timetable-imports/source.pdf',
    'student-photos/../learning-materials/private.png',
    'student-photos/./photo.png',
    'student-photos/%2e%2e%2flearning-materials/private.png',
    'student-photos/%252e%252e/private.png',
    'student-photos\\photo.png',
    'student-photos//photo.png',
    '/student-photos/photo.png',
    'student-photos/photo.png?key=notices/private.pdf',
    'student-photos/photo.png\0',
    'student-photos/photo.svg',
    'student-photos/file.pdf',
    'student-photos-evil/photo.png',
    'https://example.com/photo.png',
    'defaults/private.png',
    'photo.png',
  ];
  it.each(scopes.flatMap((scope) => deniedKeys.map((key) => ({ scope, key }))))(
    'rejects $key in $scope scope',
    ({ scope, key }) => {
      expect(() => assertPublicImageKey(key, scope)).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each([
    { scope: 'campus', key: 'student-photos/photo.jpg' },
    { scope: 'campus', key: 'lost-found/items/wallet.webp' },
    { scope: 'campus', key: 'marketplace-images/item.gif' },
    { scope: 'student', key: 'student-photos/photo.PNG' },
    { scope: 'marketplace', key: 'marketplace-images/item.jpeg' },
    ...scopes.map((scope) => ({
      scope,
      key: 'defaults/student-placeholder.png',
    })),
  ])('preserves $key in $scope scope', ({ scope, key }) => {
    expect(() =>
      assertPublicImageKey(key, scope as PublicImageScope),
    ).not.toThrow();
  });

  it.each([
    { scope: 'student', key: 'marketplace-images/item.png' },
    { scope: 'student', key: 'lost-found/item.png' },
    { scope: 'marketplace', key: 'student-photos/photo.png' },
    { scope: 'marketplace', key: 'lost-found/item.png' },
  ])('rejects cross-purpose $key in $scope scope', ({ scope, key }) => {
    expect(() => assertPublicImageKey(key, scope as PublicImageScope)).toThrow(
      ForbiddenException,
    );
  });
});

describe('Public storage HTTP routes', () => {
  let app: INestApplication;
  let storage: StrictR2StorageService;
  let readObject: jest.SpyInstance;
  const routes = [
    { route: '/api/storage/stream', query: true, image: 'lost-found/item.png' },
    {
      route: '/api/v1/storage/stream',
      query: true,
      image: 'lost-found/item.png',
    },
    { route: '/api/storage/photo', query: false, image: 'lost-found/item.png' },
    {
      route: '/api/v1/storage/photo',
      query: false,
      image: 'lost-found/item.png',
    },
    {
      route: '/api/marketplace/images/stream',
      query: true,
      image: 'marketplace-images/item.png',
    },
    {
      route: '/api/v1/marketplace/images/stream',
      query: true,
      image: 'marketplace-images/item.png',
    },
    {
      route: '/api/marketplace/images',
      query: false,
      image: 'marketplace-images/item.png',
    },
    {
      route: '/api/v1/marketplace/images',
      query: false,
      image: 'marketplace-images/item.png',
    },
    {
      route: '/api/v1/students/photo/stream',
      query: true,
      image: 'student-photos/photo.png',
    },
  ];
  function fetchImage(endpoint: (typeof routes)[number], key: string) {
    const client = request(app.getHttpServer());
    return endpoint.query
      ? client.get(endpoint.route).query({ key })
      : client.get(
          `${endpoint.route}/${key.split('/').map(encodeURIComponent).join('/')}`,
        );
  }

  beforeAll(async () => {
    // Real policy and controller/service wiring, with only object storage and DB mocked.
    const module = await Test.createTestingModule({
      controllers: [
        StorageController,
        MarketplaceMediaController,
        StudentController,
      ],
      providers: [
        { provide: StudentRegistrationService, useValue: {} },
        StrictR2StorageService,
        StudentService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PrismaService, useValue: {} },
        { provide: StudentRepository, useValue: {} },
        { provide: NoticesService, useValue: {} },
      ],
    }).compile();
    storage = module.get(StrictR2StorageService);
    readObject = jest.spyOn(storage, 'getObjectStream');
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });
  beforeEach(() => {
    readObject.mockReset();
    readObject.mockImplementation(async () => ({
      stream: Readable.from(Buffer.from('image-bytes')),
      contentType: 'image/png',
    }));
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(
    routes.flatMap((endpoint) =>
      [
        'learning-materials/private.pdf',
        'learning-materials/private.png',
        'notices/private.pdf',
        'timetable-imports/source.pdf',
      ].map((key) => ({ ...endpoint, key })),
    ),
  )(
    'blocks private object $key through $route before storage access',
    async (endpoint) => {
      await fetchImage(endpoint, endpoint.key).expect(403);
      expect(readObject).not.toHaveBeenCalled();
    },
  );
  it.each(routes)(
    'preserves public images through $route',
    async (endpoint) => {
      const response = await fetchImage(endpoint, endpoint.image).expect(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(readObject).toHaveBeenCalledWith(endpoint.image);
    },
  );
  it('preserves the student placeholder when a photo key is absent', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/students/photo/stream')
      .expect(200);
    expect(readObject).toHaveBeenCalledWith('defaults/student-placeholder.png');
  });
  it.each([
    'application/pdf',
    'text/html',
    'image/svg+xml',
    'application/octet-stream',
  ])(
    'does not pipe %s content even when its object key looks like an image',
    async (contentType) => {
      const stream = Readable.from(Buffer.from('private-or-active-content'));
      const pipe = jest.spyOn(stream, 'pipe');
      readObject.mockResolvedValue({ stream, contentType });
      await fetchImage(routes[0], routes[0].image).expect(403);
      expect(pipe).not.toHaveBeenCalled();
      expect(stream.destroyed).toBe(true);
    },
  );
});
