import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordMailService } from './password-mail.service';

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const safeUser = (u: any) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  mustChangePassword: u.mustChangePassword,
});
@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private deliveries = new Set<Promise<void>>();
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: PasswordMailService,
  ) {}
  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      void this.cleanup().catch(() =>
        this.logger.warn('Expired session cleanup failed.'),
      );
    }, 3600000);
    this.cleanupTimer.unref();
  }
  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await Promise.allSettled([...this.deliveries]);
  }
  private async cleanup() {
    await this.db.authThrottle.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await this.db.passwordReset.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    });
    await this.db.authSession.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400000) } },
    });
  }
  async throttle(scope: string, key: string, max = 15) {
    const bucket = Math.floor(Date.now() / 600000);
    const record = await this.db.authThrottle.upsert({
      where: { key: hash(`${scope}:${key}:${bucket}`) },
      create: {
        key: hash(`${scope}:${key}:${bucket}`),
        expiresAt: new Date((bucket + 2) * 600000),
      },
      update: { attempts: { increment: 1 } },
    });
    if (record.attempts > max)
      throw new HttpException(
        'Too many attempts. Try again in 10 minutes.',
        429,
      );
  }
  private async credentials(
    user: any,
    familyId = randomUUID(),
    tx: any = this.db,
  ) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        familyId,
        authVersion: user.authVersion,
        refreshHash: hash(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        sid: session.id,
        purpose: user.mustChangePassword ? 'password-change' : 'access',
      },
      { expiresIn: '15m' },
    );
    return { accessToken, refreshToken, user: safeUser(user) };
  }
  async issue(user: any) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: user.id },
        include: { role: true },
      });
      if (
        !current?.isActive ||
        !current.role.isActive ||
        current.password !== user.password
      )
        throw new UnauthorizedException(
          'Account credentials changed. Sign in again.',
        );
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      return this.credentials(current, undefined, tx);
    });
  }
  async refresh(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || ''))
      throw new UnauthorizedException('Invalid refresh session.');
    // Keep revoked rows until expiry to detect replay of a rotated token.
    const result = await this.db.$transaction(async (tx) => {
      const initial = await tx.authSession.findUnique({
        where: { refreshHash: hash(token) },
      });
      if (!initial) return null;
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${initial.userId} FOR UPDATE`;
      const session = await tx.authSession.findUnique({
        where: { refreshHash: hash(token) },
        include: { user: { include: { role: true } } },
      });
      if (!session) return null;
      if (
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive ||
        !session.user.role.isActive ||
        session.authVersion !== session.user.authVersion
      ) {
        await tx.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      const claimed = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!claimed.count) {
        await tx.authSession.updateMany({
          where: { familyId: session.familyId },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      return this.credentials(session.user, session.familyId, tx);
    });
    if (!result)
      throw new UnauthorizedException(
        'Session expired or revoked. Sign in again.',
      );
    return result;
  }
  async logout(token?: string, sessionId?: string) {
    const row = token
      ? await this.db.authSession.findUnique({
          where: { refreshHash: hash(token) },
        })
      : sessionId
        ? await this.db.authSession.findUnique({ where: { id: sessionId } })
        : null;
    if (row)
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${row.userId} FOR UPDATE`;
        await tx.authSession.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
  }
  async revokeAll(userId: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { success: true };
  }
  async sessions(userId: string, current: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { authVersion: true },
    });
    const rows = await this.db.authSession.findMany({
      where: {
        userId,
        authVersion: user?.authVersion,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({ ...r, current: r.id === current }));
  }
  async revoke(userId: string, id: string) {
    const row = await this.db.authSession.findUnique({ where: { id } });
    if (row?.userId === userId)
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        await tx.authSession.updateMany({
          where: { familyId: row.familyId, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    return { success: true };
  }
  async change(userId: string, currentPassword: string, newPassword: string) {
    if (Buffer.byteLength(newPassword, 'utf8') > 72)
      throw new BadRequestException('Password must be at most 72 UTF-8 bytes.');
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password)))
      throw new BadRequestException('Current password is incorrect.');
    if (await bcrypt.compare(newPassword, user.password))
      throw new BadRequestException('Choose a different password.');
    const password = await bcrypt.hash(newPassword, 12);
    await this.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, password: user.password },
        data: { password, mustChangePassword: false },
      });
      if (!changed.count)
        throw new UnauthorizedException('Credentials changed. Sign in again.');
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordReset.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });
    return {
      success: true,
      message: 'Password updated. Sign in again on all devices.',
    };
  }
  async forgot(email: string) {
    this.mail.assertConfigured();
    const generic = {
      success: true,
      message:
        'If an active account matches that email, a recovery link will be sent.',
    };
    const user = await this.db.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user?.isActive || !user.role.isActive) return generic;
    const token = randomBytes(32).toString('base64url');
    const row = await this.db.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        passwordHashAtIssue: user.password,
        expiresAt: new Date(Date.now() + 1200000),
      },
    });
    // Do not expose account existence through email-provider response latency.
    const delivery = Promise.resolve()
      .then(() => this.mail.send(email, token))
      .catch(async () => {
        this.logger.warn('Password recovery delivery failed.');
        await this.db.passwordReset.deleteMany({ where: { id: row.id } });
      })
      .catch(() => {
        this.logger.warn('Password recovery cleanup failed.');
      });
    this.deliveries.add(delivery);
    void delivery.finally(() => this.deliveries.delete(delivery));
    return generic;
  }
  async reset(token: string, newPassword: string) {
    if (Buffer.byteLength(newPassword, 'utf8') > 72)
      throw new BadRequestException('Password must be at most 72 UTF-8 bytes.');
    const row = await this.db.passwordReset.findUnique({
      where: { tokenHash: hash(token) },
      include: { user: { include: { role: true } } },
    });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt <= new Date() ||
      !row.user.isActive ||
      !row.user.role.isActive ||
      row.user.password !== row.passwordHashAtIssue
    )
      throw new BadRequestException(
        'This recovery link is invalid or expired.',
      );
    if (await bcrypt.compare(newPassword, row.user.password))
      throw new BadRequestException('Choose a different password.');
    const password = await bcrypt.hash(newPassword, 12);
    await this.db.$transaction(async (tx) => {
      const used = await tx.passwordReset.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!used.count)
        throw new BadRequestException(
          'This recovery link has already been used.',
        );
      const changed = await tx.user.updateMany({
        where: { id: row.userId, password: row.passwordHashAtIssue },
        data: { password, mustChangePassword: false },
      });
      if (!changed.count)
        throw new BadRequestException('This recovery link is no longer valid.');
      await tx.passwordReset.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return {
      success: true,
      message: 'Password reset. Sign in using your new password.',
    };
  }
}
