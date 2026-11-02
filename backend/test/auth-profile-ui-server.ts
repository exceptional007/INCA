/** Disposable localhost-only browser test server; never imports project .env. */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { testUrl } from './auth-profile-db';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthRepository } from '../src/modules/auth/repositories/auth.repository';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { SessionService } from '../src/modules/auth/session.service';
import { SessionController } from '../src/modules/auth/session.controller';
import { PasswordMailService } from '../src/modules/auth/password-mail.service';
import { ProfileService } from '../src/modules/profile/profile.service';
import { ProfileController } from '../src/modules/profile/profile.controller';
import { StrictR2StorageService } from '../src/modules/storage/strict-r2-storage.service';

async function main() {
  const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
  await db.profileChangeRequest.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  const dept = await db.department.findUniqueOrThrow({
    where: { code: 'TEST' },
  });
  const password = await bcrypt.hash('InitialPassword123', 4);
  const studentRole = await db.role.findUniqueOrThrow({
      where: { code: 'STUDENT' },
    }),
    adminRole = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  for (const id of ['viewer', 'reviewer']) {
    const email = `${id}.demo@bit.ac.in`,
      isStudent = id === 'viewer';
    await db.user.upsert({
      where: { email },
      update: { password, mustChangePassword: isStudent },
      create: {
        email,
        password,
        mustChangePassword: isStudent,
        roleId: isStudent ? studentRole.id : adminRole.id,
        ...(isStudent
          ? {
              student: {
                create: {
                  firstName: 'Aarav',
                  lastName: 'Sharma',
                  gender: 'MALE',
                  collegeId: 'DEMO-2026',
                  rollNumber: 'CS-024',
                  enrollmentNumber: 'SYNTHETIC-024',
                  departmentId: dept.id,
                  phone: '+91 98765 43210',
                  address: 'Synthetic campus residence',
                  dateOfBirth: new Date('2004-08-15'),
                },
              },
            }
          : {
              adminProfile: {
                create: { name: 'Department Reviewer', departmentId: dept.id },
              },
            }),
      },
    });
  }
  const viewer = await db.user.findUniqueOrThrow({
    where: { email: 'viewer.demo@bit.ac.in' },
  });
  await db.passwordReset.deleteMany({ where: { userId: viewer.id } });
  await db.passwordReset.create({
    data: {
      userId: viewer.id,
      tokenHash: createHash('sha256').update('r'.repeat(43)).digest('hex'),
      passwordHashAtIssue: viewer.password,
      expiresAt: new Date(Date.now() + 1200000),
    },
  });
  const config = {
    get: (k: string) =>
      ({ FRONTEND_URL: 'http://127.0.0.1:5184', NODE_ENV: 'test' })[k],
    getOrThrow: () => 'disposable-browser-session-secret-32-characters',
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDEYAAAAASUVORK5CYII=',
    'base64',
  );
  const module = await Test.createTestingModule({
    imports: [PassportModule],
    controllers: [AuthController, SessionController, ProfileController],
    providers: [
      AuthService,
      AuthRepository,
      SessionService,
      ProfileService,
      JwtStrategy,
      { provide: PrismaService, useValue: db },
      {
        provide: JwtService,
        useValue: new JwtService({
          secret: 'disposable-browser-session-secret-32-characters',
        }),
      },
      { provide: ConfigService, useValue: config },
      {
        provide: PasswordMailService,
        useValue: { assertConfigured: () => {}, send: async () => {} },
      },
      {
        provide: StrictR2StorageService,
        useValue: {
          uploadPendingProfilePhoto: async () => 'profile-requests/demo.png',
          promoteProfilePhoto: async () => 'student-photos/demo.png',
          deleteObject: async () => {},
          getObjectStream: async () => ({
            stream: Readable.from(png),
            contentType: 'image/png',
          }),
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.enableCors({ origin: 'http://127.0.0.1:5184', credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(5334, '127.0.0.1');
  console.log('Disposable synthetic auth/profile API ready on 127.0.0.1:5334');
  const close = async () => {
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
