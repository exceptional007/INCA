import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAudit(data: {
    attendanceRecordId: string;
    oldStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    editedById: string;
    reason?: string;
  }) {
    return this.prisma.attendanceAudit.create({
      data: {
        attendanceRecordId: data.attendanceRecordId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        editedById: data.editedById,
        reason: data.reason ?? null,
      },
      include: {
        editedBy: true,
        attendanceRecord: { include: { student: true } },
      },
    });
  }

  async findByRecord(attendanceRecordId: string) {
    return this.prisma.attendanceAudit.findMany({
      where: { attendanceRecordId },
      include: { editedBy: true },
      orderBy: { editedAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.attendanceAudit.findMany({
      include: {
        editedBy: true,
        attendanceRecord: { include: { student: true } },
      },
      orderBy: { editedAt: 'desc' },
    });
  }
}
