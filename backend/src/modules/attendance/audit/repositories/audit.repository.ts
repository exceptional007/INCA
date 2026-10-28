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
        editedBy: {
          select: { id: true, email: true, isActive: true },
        },
        attendanceRecord: { include: { student: true } },
      },
    });
  }

  async editRecordWithAudit(data: {
    recordId: string;
    oldStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    editedById: string;
    reason?: string;
    remarks?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const audit = await tx.attendanceAudit.create({
        data: {
          attendanceRecordId: data.recordId,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          editedById: data.editedById,
          reason: data.reason ?? null,
        },
        include: {
          editedBy: {
            select: { id: true, email: true, isActive: true },
          },
          attendanceRecord: { include: { student: true } },
        },
      });

      const record = await tx.attendanceRecord.update({
        where: { id: data.recordId },
        data: {
          status: data.newStatus,
          remarks: data.remarks,
        },
      });

      return { audit, record };
    });
  }

  async findByRecord(attendanceRecordId: string) {
    return this.prisma.attendanceAudit.findMany({
      where: { attendanceRecordId },
      include: {
        editedBy: {
          select: { id: true, email: true, isActive: true },
        },
      },
      orderBy: { editedAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.attendanceAudit.findMany({
      include: {
        editedBy: {
          select: { id: true, email: true, isActive: true },
        },
        attendanceRecord: { include: { student: true } },
      },
      orderBy: { editedAt: 'desc' },
    });
  }
}
