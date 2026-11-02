import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AttendanceAccessService } from '../sessions/attendance-access.service';
import type { AttendanceActor } from '../sessions/attendance-access.service';
import type { SyncAttendanceDto } from './offline-attendance.controller';

export const attendanceSignature = (records: { studentId: string; status: string }[]) =>
  JSON.stringify(records.map(record => [record.studentId, record.status]).sort((a, b) => a[0].localeCompare(b[0])));

@Injectable()
export class OfflineAttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly access: AttendanceAccessService) {}

  async sync(sessionId: string, dto: SyncAttendanceDto, actor: AttendanceActor) {
    const scope = await this.access.sessionScope(actor, true);
    try {
      const session = await this.prisma.$transaction(async tx => {
        const current = await tx.attendanceSession.findFirst({
          where: { id: sessionId, AND: [scope] },
          include: { records: true, schedule: { include: { template: true } } },
        });
        if (!current) throw new ForbiddenException('You no longer have access to this attendance session. Your local copy is retained.');
        const desired = attendanceSignature(dto.records);
        const existing = attendanceSignature(current.records);
        if (current.status === 'SUBMITTED') {
          if (desired !== existing) throw new ConflictException('This class was submitted with different attendance. Your local copy is retained for review.');
          return current;
        }
        if (current.status !== 'OPEN' || !current.schedule || current.schedule.status === 'CANCELLED')
          throw new ConflictException('This lecture is no longer open for attendance. Your local copy is retained.');
        const sectionId = current.schedule.template.sectionId;
        if (!sectionId) throw new ConflictException('The lecture has no assigned section.');
        const roster = await tx.student.findMany({ where: { sectionId, isActive: true }, select: { id: true } });
        const ids = dto.records.map(record => record.studentId);
        if (new Set(ids).size !== ids.length || JSON.stringify([...ids].sort()) !== JSON.stringify(roster.map(student => student.id).sort()))
          throw new ConflictException('The enrolled student list changed. Review the retained local copy before uploading.');
        if (current.records.some(record => !ids.includes(record.studentId)))
          throw new ConflictException('The cloud contains records outside the prepared roster. Review the retained local copy.');
        if (existing !== dto.baseline && existing !== desired)
          throw new ConflictException('Attendance changed on another device. Your local copy is retained for review.');
        await tx.attendanceRecord.createMany({
          data: dto.records.filter(record => !current.records.some(saved => saved.studentId === record.studentId)).map(record => ({ attendanceSessionId: sessionId, studentId: record.studentId, status: record.status, remarks: record.remarks ?? null })),
        });
        // Only changed statuses need individual updates; no external work occurs in this transaction.
        for (const record of dto.records) {
          const previous = current.records.find(saved => saved.studentId === record.studentId);
          if (previous && previous.status !== record.status) await tx.attendanceRecord.update({ where: { id: previous.id }, data: { status: record.status, remarks: record.remarks ?? previous.remarks } });
        }
        return tx.attendanceSession.update({ where: { id: sessionId }, data: { status: 'SUBMITTED', submittedAt: new Date() }, include: { records: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 20000 });
      return { success: true, message: 'Attendance uploaded and locked.', data: session };
    } catch (error: any) {
      if (error.code === 'P2034') throw new ServiceUnavailableException('Attendance changed during upload. Your local copy is retained; retry sync.');
      throw error;
    }
  }
}
