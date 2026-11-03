import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AttendanceRecordItemDto } from '../dto/attendance-record-item.dto';

@Injectable()
export class RecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySession(sessionId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId },
      include: {
        student: true,
        audits: {
          include: {
            editedBy: { select: { id: true, email: true, isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        student: true,
        attendanceSession: true,
        audits: {
          include: {
            editedBy: { select: { id: true, email: true, isActive: true } },
          },
        },
      },
    });
  }

  async bulkCreate(
    sessionId: string,
    records: AttendanceRecordItemDto[],
    authorize: (tx: any) => Promise<void>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await authorize(tx);
          const saved: any[] = [];
          for (const r of records)
            saved.push(
              await tx.attendanceRecord.upsert({
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
                update: { status: r.status, remarks: r.remarks ?? null },
              }),
            );
          return saved;
        },
        { isolationLevel: 'Serializable', timeout: 20000 },
      );
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Attendance changed during saving. Refresh and retry.',
        );
      throw error;
    }
  }

  async update(id: string, data: { status?: any; remarks?: string | null }) {
    return this.prisma.attendanceRecord.update({
      where: { id },
      data,
    });
  }
}
