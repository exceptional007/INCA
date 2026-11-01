/** Runs only against the explicitly created disposable loopback test database. */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { randomBytes,createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../src/modules/auth/session.service';
import { ProfileService } from '../src/modules/profile/profile.service';

export const testUrl = 'postgresql://inca_test@127.0.0.1:55438/inca_lifecycle';
export async function verifyDatabase() {
  const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
  const mail = { assertConfigured: () => {}, send: async () => {} };
  const storage = {
    promoteProfilePhoto: async () => 'student-photos/synthetic.png',
    deleteObject: async () => {},
    uploadPendingProfilePhoto: async () => 'profile-requests/synthetic.png',
  };
  const sessions = new SessionService(
    db as any,
    new JwtService({
      secret: 'disposable-db-integration-secret-32-characters',
    }),
    mail as any,
  );
  const profiles = new ProfileService(db as any, storage as any);
  try {
    const role = await db.role.upsert({
      where: { code: 'STUDENT' },
      update: {},
      create: { code: 'STUDENT', name: 'Student' },
    });
    const adminRole = await db.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: { code: 'ADMIN', name: 'Admin' },
    });
    const dept = await db.department.upsert({
      where: { code: 'TEST' },
      update: {},
      create: { code: 'TEST', name: 'Disposable Test Department' },
    });
    const password = await bcrypt.hash('InitialPassword123', 4);
    const student = await db.user.create({
      data: {
        email: `integration-${Date.now()}@bit.ac.in`,
        password,
        roleId: role.id,
        mustChangePassword: false,
        student: {
          create: {
            firstName: 'Integration',
            gender: 'OTHER',
            collegeId: 'TEST-' + Date.now(),
            rollNumber: 'TEST-' + Date.now(),
            enrollmentNumber: 'TEST-' + Date.now(),
            departmentId: dept.id,
          },
        },
      },
      include: { role: true },
    });
    const admin = await db.user.create({
      data: {
        email: `admin-integration-${Date.now()}@bit.ac.in`,
        password,
        roleId: adminRole.id,
        mustChangePassword: false,
        adminProfile: { create: { name: 'Test Admin', departmentId: dept.id } },
      },
      include: { role: true },
    });
    const credential = await sessions.issue(student);
    const rotations = await Promise.allSettled([
      sessions.refresh(credential.refreshToken),
      sessions.refresh(credential.refreshToken),
    ]);
    assert.equal(rotations.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      await db.authSession.count({
        where: { userId: student.id, revokedAt: null },
      }),
      0,
    );
    console.log('PASS: PostgreSQL refresh serialization and replay revocation');
    const p = await profiles.me(student.id);
    const request = await profiles.submit(
      student.id,
      { firstName: 'Approved Name' },
      p.revision,
    );
    assert.equal(
      (await db.student.findUniqueOrThrow({ where: { userId: student.id } }))
        .firstName,
      'Integration',
    );
    const approvals = await Promise.allSettled([
      profiles.decide(admin.id, request.id, 'APPROVED'),
      profiles.decide(admin.id, request.id, 'APPROVED'),
    ]);
    assert.equal(approvals.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      (await db.student.findUniqueOrThrow({ where: { userId: student.id } }))
        .firstName,
      'Approved Name',
    );
    assert.equal(
      await db.notifications.count({ where: { userId: student.id } }),
      1,
    );
    console.log(
      'PASS: PostgreSQL JSONB revision hashes, atomic application, and concurrent approval',
    );
    const current = await profiles.me(student.id);
    const pending = await profiles.submit(
      student.id,
      { phone: '1234567890' },
      current.revision,
    );
    await assert.rejects(
      db.profileChangeRequest.create({
        data: { userId: student.id, changes: {}, previous: {} },
      }),
    );
    await assert.rejects(
      db.profileChangeRequest.update({
        where: { id: pending.id },
        data: { reviewerId: student.id, status: 'APPROVED' },
      }),
    );
    console.log('PASS: database uniqueness and self-review constraints');
    const issued = await sessions.issue(
      await db.user.findUniqueOrThrow({
        where: { id: student.id },
        include: { role: true },
      }),
    );
    const version = (
      await db.user.findUniqueOrThrow({ where: { id: student.id } })
    ).authVersion;
    await db.user.update({
      where: { id: student.id },
      data: { isActive: false },
    });
    await db.user.update({
      where: { id: student.id },
      data: { isActive: true },
    });
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
        .authVersion,
      version + 2,
    );
    await assert.rejects(sessions.refresh(issued.refreshToken));
    console.log(
      'PASS: database security trigger invalidates sessions across suspension/reactivation',
    );
    const latest = await db.user.findUniqueOrThrow({
      where: { id: student.id },
      include: { role: true },
    });
    const device = await sessions.issue(latest);
    await sessions.change(
      student.id,
      'InitialPassword123',
      'ReplacementPassword456',
    );
    await assert.rejects(sessions.refresh(device.refreshToken));
    assert.equal(
      await bcrypt.compare(
        'ReplacementPassword456',
        (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
          .password,
      ),
      true,
    );
    console.log(
      'PASS: password change and global revocation against PostgreSQL',
    );
    const token=randomBytes(32).toString('base64url');
    const resetUser=await db.user.findUniqueOrThrow({where:{id:student.id}});
    await db.passwordReset.create({data:{userId:student.id,tokenHash:createHash('sha256').update(token).digest('hex'),passwordHashAtIssue:resetUser.password,expiresAt:new Date(Date.now()+1200000)}});
    const resets=await Promise.allSettled([sessions.reset(token,'RecoveredPassword789'),sessions.reset(token,'RecoveredPassword789')]);
    assert.equal(resets.filter(r=>r.status==='fulfilled').length,1);
    console.log('PASS: PostgreSQL recovery token is consumed exactly once under concurrent resets');
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module)
  verifyDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
