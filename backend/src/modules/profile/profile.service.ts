import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { createHash } from 'node:crypto';

const include = {
  role: true,
  student: { include: { department: true, section: true } },
  faculty: { include: { department: true } },
  adminProfile: { include: { department: true } },
};
const shared = ['firstName', 'lastName', 'phone', 'gender', 'dateOfBirth'];
const studentFields = [
  ...shared,
  'address',
  'bloodGroup',
  'emergencyContactName',
  'emergencyContactPhone',
];
const digest = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(v, Object.keys(v as object).sort()))
    .digest('hex');
@Injectable()
export class ProfileService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StrictR2StorageService,
  ) {}
  private async user(id: string, tx: any = this.db) {
    const u = await tx.user.findUnique({ where: { id }, include });
    if (!u?.isActive || !u.role.isActive)
      throw new ForbiddenException('Account is not available.');
    return u;
  }
  private fields(u: any) {
    return u.student ? studentFields : u.faculty ? shared : ['name', 'phone'];
  }
  private values(u: any): Record<string, any> {
    const p = u.student || u.faculty;
    const values: Record<string, any> = {};
    for (const field of this.fields(u))
      values[field] = p
        ? field === 'dateOfBirth'
          ? p[field]?.toISOString().slice(0, 10) || null
          : (p[field] ?? null)
        : field === 'name'
          ? u.adminProfile?.name || u.displayName || u.email.split('@')[0]
          : (u.profilePhone ?? null);
    values.photoKey = u.profilePhotoKey || p?.photoKey || null;
    return values;
  }
  private department(u: any) {
    return u.role.code === 'ADMIN'
      ? u.adminProfile?.departmentId
      : u.student?.departmentId || u.faculty?.departmentId;
  }
  canReview(actor: any, target: any): boolean {
    if (actor.id === target.id || !actor.isActive || !actor.role.isActive)
      return false;
    if (actor.role.code === 'SUPER_ADMIN') return true;
    if (['ADMIN', 'SUPER_ADMIN'].includes(target.role.code)) return false;
    const dept = this.department(target);
    if (actor.role.code === 'ADMIN')
      return (
        (!!dept && dept === this.department(actor)) ||
        (!dept && target.role.code === 'COORDINATOR')
      );
    return (
      actor.role.code === 'HOD' &&
      ['FACULTY', 'STUDENT'].includes(target.role.code) &&
      !!dept &&
      dept === this.department(actor)
    );
  }
  private publicProfile(u: any) {
    const p = u.student || u.faculty;
    const values = this.values(u);
    return {
      id: u.id,
      email: u.email,
      role: u.role.code,
      roleName: u.role.name,
      values,
      revision: digest(values),
      editableFields: this.fields(u),
      department: p?.department || u.adminProfile?.department || null,
      academic: u.student
        ? {
            collegeId: p.collegeId,
            rollNumber: p.rollNumber,
            enrollmentNumber: p.enrollmentNumber,
            section: p.section?.name || null,
          }
        : u.faculty
          ? { employeeCode: p.employeeCode, designation: p.designation }
          : null,
      joinedAt: u.createdAt,
      mustChangePassword: u.mustChangePassword,
    };
  }
  async me(id: string) {
    return this.publicProfile(await this.user(id));
  }
  private validateChanges(u: any, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('Changes must be an object.');
    const allowed = this.fields(u),
      result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!allowed.includes(key))
        throw new BadRequestException(
          `Field ${key} cannot be changed through profile requests.`,
        );
      if (value !== null && typeof value !== 'string')
        throw new BadRequestException(`Invalid ${key}.`);
      let v = typeof value === 'string' ? value.trim() : null;
      if (v !== null && v.length > (key === 'address' ? 1000 : 120))
        throw new BadRequestException(`${key} is too long.`);
      if (['firstName', 'name'].includes(key) && !v)
        throw new BadRequestException('Name cannot be empty.');
      if (key === 'gender' && !['MALE', 'FEMALE', 'OTHER'].includes(v || ''))
        throw new BadRequestException('Invalid gender.');
      if (
        key === 'bloodGroup' &&
        v &&
        ![
          'A_POSITIVE',
          'A_NEGATIVE',
          'B_POSITIVE',
          'B_NEGATIVE',
          'AB_POSITIVE',
          'AB_NEGATIVE',
          'O_POSITIVE',
          'O_NEGATIVE',
        ].includes(v)
      )
        throw new BadRequestException('Invalid blood group.');
      if (
        ['phone', 'emergencyContactPhone'].includes(key) &&
        v &&
        !/^[+\d() .-]{7,25}$/.test(v)
      )
        throw new BadRequestException('Enter a valid phone number.');
      if (
        key === 'dateOfBirth' &&
        v &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(new Date(v).getTime()) ||
          new Date(v) > new Date() ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        throw new BadRequestException('Enter a valid date of birth.');
      result[key] = v || null;
    }
    return result;
  }
  private image(file: Express.Multer.File) {
    const b = file.buffer;
    if (b.length > 5 * 1024 * 1024 || !b.length)
      throw new BadRequestException('Photo must be under 5 MB.');
    if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      return { type: 'image/png', ext: 'png' };
    if (b[0] === 255 && b[1] === 216 && b[2] === 255)
      return { type: 'image/jpeg', ext: 'jpg' };
    if (
      b.subarray(0, 4).toString() === 'RIFF' &&
      b.subarray(8, 12).toString() === 'WEBP'
    )
      return { type: 'image/webp', ext: 'webp' };
    throw new BadRequestException('Upload a PNG, JPEG, or WebP image.');
  }
  async submit(
    id: string,
    input: unknown,
    revision: string,
    file?: Express.Multer.File,
  ) {
    const u = await this.user(id),
      previous = this.values(u);
    if (revision !== digest(previous))
      throw new ConflictException(
        'Your profile changed. Reload it before submitting.',
      );
    const changes = this.validateChanges(u, input);
    for (const k of Object.keys(changes))
      if (changes[k] === previous[k]) delete changes[k];
    if (!Object.keys(changes).length && !file)
      throw new BadRequestException(
        'Choose at least one change or a new photo.',
      );
    let photoKey: string | undefined;
    if (file) {
      const image = this.image(file);
      photoKey = await this.storage.uploadPendingProfilePhoto(
        file.buffer,
        image.type,
        image.ext,
      );
    }
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
        const current = await this.user(id, tx);
        if (digest(this.values(current)) !== revision)
          throw new ConflictException(
            'Profile changed. Reload before submitting.',
          );
        if (
          await tx.profileChangeRequest.findFirst({
            where: { userId: id, status: 'PENDING' },
          })
        )
          throw new ConflictException(
            'You already have a pending request. Cancel it before submitting another.',
          );
        const request = await tx.profileChangeRequest.create({
          data: { userId: id, changes, previous, photoKey },
        });
        return request;
      });
    } catch (error) {
      if (photoKey) await this.storage.deleteObject(photoKey).catch(() => {});
      throw error;
    }
  }
  async history(id: string) {
    return this.db.profileChangeRequest.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { reviewer: { select: { id: true, email: true } } },
    });
  }
  async queue(id: string) {
    const actor = await this.user(id);
    if (!['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role.code))
      throw new ForbiddenException('Reviewer access required.');
    const departmentId = this.department(actor);
    const where: any = { status: 'PENDING', userId: { not: id } };
    if (actor.role.code !== 'SUPER_ADMIN') {
      const roles =
        actor.role.code === 'HOD'
          ? ['FACULTY', 'STUDENT']
          : ['FACULTY', 'STUDENT', 'HOD', 'COORDINATOR'];
      where.user = {
        isActive: true,
        role: { code: { in: roles }, isActive: true },
        OR: [
          ...(departmentId
            ? [{ student: { departmentId } }, { faculty: { departmentId } }]
            : []),
          ...(actor.role.code === 'ADMIN'
            ? [{ role: { code: 'COORDINATOR' }, faculty: null, student: null }]
            : []),
        ],
      };
    }
    const rows = await this.db.profileChangeRequest.findMany({
      where,
      include: { user: { include } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows
      .filter((r) => this.canReview(actor, r.user))
      .map(({ user, ...r }) => ({ ...r, profile: this.publicProfile(user) }));
  }
  async decide(
    actorId: string,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    if (
      decision === 'REJECTED' &&
      (!reason?.trim() || reason.trim().length < 3 || reason.length > 2000)
    )
      throw new BadRequestException(
        'A rejection reason of 3–2000 characters is required.',
      );
    const actor = await this.user(actorId);
    const initial = await this.db.profileChangeRequest.findUnique({
      where: { id },
      include: { user: { include } },
    });
    if (!initial) throw new NotFoundException('Profile request not found.');
    if (!this.canReview(actor, initial.user))
      throw new ForbiddenException('You cannot review this request.');
    if (initial.status !== 'PENDING')
      throw new ConflictException('This request has already been reviewed.');
    // External copy occurs before the short database transaction; failures clean up the copy.
    const promoted =
      decision === 'APPROVED' && initial.photoKey
        ? await this.storage.promoteProfilePhoto(initial.photoKey)
        : undefined;
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${initial.userId} FOR UPDATE`;
        const target = await this.user(initial.userId, tx),
          reviewer = await this.user(actorId, tx);
        if (!this.canReview(reviewer, target))
          throw new ForbiddenException('Review permissions changed.');
        const current = await tx.profileChangeRequest.findUnique({
          where: { id },
        });
        if (!current || current.status !== 'PENDING')
          throw new ConflictException('Request already reviewed or cancelled.');
        if (decision === 'APPROVED') {
          if (digest(this.values(target)) !== digest(current.previous))
            throw new ConflictException(
              'Profile changed since this request. Reject it and ask for a new request.',
            );
          const changes = this.validateChanges(target, current.changes);
          if (target.student || target.faculty) {
            const data: any = { ...changes };
            if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
            if (promoted) data.photoKey = promoted;
            if (target.student)
              await tx.student.update({ where: { userId: target.id }, data });
            else
              await tx.faculty.update({ where: { userId: target.id }, data });
          } else if (target.adminProfile && changes.name) {
            await tx.adminProfile.update({
              where: { userId: target.id },
              data: { name: changes.name },
            });
          }
          await tx.user.update({
            where: { id: target.id },
            data: {
              ...(!target.student && !target.faculty
                ? {
                    ...(changes.name ? { displayName: changes.name } : {}),
                    ...('phone' in changes
                      ? { profilePhone: changes.phone }
                      : {}),
                  }
                : {}),
              ...(promoted ? { profilePhotoKey: promoted } : {}),
            },
          });
        }
        const result = await tx.profileChangeRequest.update({
          where: { id },
          data: {
            status: decision,
            reviewerId: actorId,
            reviewedAt: new Date(),
            reason: decision === 'REJECTED' ? reason!.trim() : null,
          },
        });
        await tx.notifications.create({
          data: {
            userId: target.id,
            type: 'PROFILE_' + decision,
            title: 'Profile update ' + decision.toLowerCase(),
            message:
              decision === 'APPROVED'
                ? 'Your approved details are now live.'
                : reason!.trim(),
          },
        });
        return result;
      });
    } catch (error) {
      if (promoted) await this.storage.deleteObject(promoted).catch(() => {});
      throw error;
    }
  }
  async cancel(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const result = await tx.profileChangeRequest.updateMany({
        where: { id, userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (!result.count)
        throw new ConflictException(
          'Only your pending request can be cancelled.',
        );
      return { success: true };
    });
  }
  async photo(actorId: string, requestId?: string) {
    const actor = await this.user(actorId);
    let key = this.values(actor).photoKey;
    if (requestId) {
      const request = await this.db.profileChangeRequest.findUnique({
        where: { id: requestId },
        include: { user: { include } },
      });
      if (
        !request ||
        (request.userId !== actorId && !this.canReview(actor, request.user))
      )
        throw new ForbiddenException('Photo access denied.');
      key = request.photoKey;
    }
    if (!key) throw new NotFoundException('No photo uploaded.');
    return this.storage.getObjectStream(key);
  }
}
