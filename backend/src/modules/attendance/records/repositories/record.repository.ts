import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AttendanceRecordItemDto } from '../dto/attendance-record-item.dto';

@Injectable()
export class RecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySession(sessionId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId },
      include: { student: true, audits: { include: { editedBy: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        student: true,
        attendanceSession: true,
        audits: { include: { editedBy: true } },
      },
    });
  }

  async bulkCreate(sessionId: string, records: AttendanceRecordItemDto[]) {
    return this.prisma.$transaction(
      records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            attendanceSessionId_studentId: {
              attendanceSessionId: sessionId,
              studentId: r.studentId,
            },
          },
          create: {
            attendanceSessionId: sessionId,
            studentId: r.studentId,
            status: r.status,
            remarks: r.remarks ?? null,
          },
          update: {
            status: r.status,
            remarks: r.remarks ?? null,
          },
        }),
      ),
    );
  }

  async update(
    id: string,
    data: { status?: any; remarks?: string | null },
  ) {
    return this.prisma.attendanceRecord.update({
      where: { id },
      data,
    });
  }
}
