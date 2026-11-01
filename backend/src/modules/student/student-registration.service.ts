import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentService } from './student.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';

@Injectable()
export class StudentRegistrationService {
  constructor(
    private readonly db: PrismaService,
    private readonly students: StudentService,
    private readonly storage: StrictR2StorageService,
  ) {}
  private async scope(userId: string) {
    const actor = await this.db.user.findUnique({
      where: { id: userId },
      include: { role: true, faculty: true, adminProfile: true },
    });
    if (
      !actor?.isActive ||
      !actor.role.isActive ||
      !['ADMIN', 'HOD', 'SUPER_ADMIN'].includes(actor.role.code)
    )
      throw new ForbiddenException(
        'Student registration requires Admin or HOD access.',
      );
    const departmentId =
      actor.role.code === 'ADMIN'
        ? actor.adminProfile?.departmentId
        : actor.faculty?.departmentId;
    if (actor.role.code !== 'SUPER_ADMIN' && !departmentId)
      throw new ForbiddenException(
        'Your department must be assigned before registering students.',
      );
    return actor.role.code === 'SUPER_ADMIN' ? null : departmentId;
  }
  async options(userId: string) {
    const departmentId = await this.scope(userId);
    const [departments, sections] = await Promise.all([
      this.db.department.findMany({
        where: {
          isActive: true,
          ...(departmentId ? { id: departmentId } : {}),
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.db.section.findMany({
        where: {
          isActive: true,
          semester: {
            isActive: true,
            program: {
              isActive: true,
              department: { isActive: true },
              ...(departmentId ? { departmentId } : {}),
            },
          },
        },
        select: {
          id: true,
          name: true,
          semester: {
            select: {
              number: true,
              program: { select: { name: true, departmentId: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { departments, sections, departmentLocked: !!departmentId };
  }
  async create(
    userId: string,
    dto: CreateStudentAccountDto,
    file?: Express.Multer.File,
  ) {
    const scope = await this.scope(userId);
    if (!dto.departmentId || (scope && dto.departmentId !== scope))
      throw new ForbiddenException(
        'Choose a department you are authorized to manage.',
      );
    const department = await this.db.department.findFirst({
      where: { id: dto.departmentId, isActive: true },
    });
    if (!department)
      throw new BadRequestException('Choose an active department.');
    if (dto.sectionId) {
      const section = await this.db.section.findFirst({
        where: {
          id: dto.sectionId,
          isActive: true,
          semester: {
            isActive: true,
            program: { isActive: true, departmentId: dto.departmentId },
          },
        },
      });
      if (!section)
        throw new BadRequestException(
          'The section must be active and belong to the selected department.',
        );
    }
    if (dto.photoKey)
      throw new BadRequestException(
        'Attach the student photo rather than supplying a storage key.',
      );
    if (
      dto.dateOfBirth &&
      dto.dateOfBirth > new Date().toISOString().slice(0, 10)
    )
      throw new BadRequestException('Date of birth cannot be in the future.');
    let photoKey: string | undefined;
    if (file) {
      if (file.size > 5 * 1024 * 1024)
        throw new BadRequestException('Photo must be no larger than 5 MB.');
      const b = file.buffer;
      const png =
        b.length >= 8 &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
      const webp =
        b.length >= 12 &&
        b.subarray(0, 4).toString() === 'RIFF' &&
        b.subarray(8, 12).toString() === 'WEBP';
      const type = png
        ? 'image/png'
        : jpg
          ? 'image/jpeg'
          : webp
            ? 'image/webp'
            : null;
      if (
        !type ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ||
        file.mimetype !== type
      )
        throw new BadRequestException(
          'Choose a valid JPG, PNG, or WebP photo.',
        );
      const uploaded = await this.students.uploadPhoto(
        b,
        `photo.${png ? 'png' : jpg ? 'jpg' : 'webp'}`,
        type,
      );
      photoKey = uploaded.photoKey;
    }
    try {
      return await this.students.createStudentAccount({
        ...dto,
        email: dto.email.trim().toLowerCase(),
        ...(photoKey ? { photoKey } : {}),
      });
    } catch (error) {
      if (photoKey) await this.storage.deleteObject(photoKey).catch(() => {});
      if (error.code === 'P2002')
        throw new ConflictException(
          'Email, college ID, roll number, or enrollment number already exists.',
        );
      throw error;
    }
  }
}
