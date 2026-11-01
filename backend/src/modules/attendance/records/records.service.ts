import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RecordRepository } from './repositories/record.repository';
import { SessionRepository } from '../sessions/repositories/session.repository';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { AttendanceAccessService } from '../sessions/attendance-access.service';
import type { AttendanceActor } from '../sessions/attendance-access.service';

@Injectable()
export class RecordsService {
  constructor(
    private readonly recordRepository: RecordRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly access: AttendanceAccessService,
  ) {}

  async submitRecords(
    sessionId: string,
    dto: SubmitAttendanceDto,
    actor: AttendanceActor,
  ): Promise<ApiResponse<any>> {
    await this.access.assertSessionAccess(sessionId, actor, true);
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(
        `Attendance session with ID ${sessionId} not found.`,
      );
    }
    if (session.status === 'SUBMITTED') {
      throw new BadRequestException(
        'This attendance session is already submitted and locked. Use the edit endpoint to make changes.',
      );
    }

    const roster = await this.sessionRepository.getRoster(sessionId);
    const eligibleIds = new Set(roster.map(student => student.id));
    const submittedIds = dto.records.map(record => record.studentId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('A student cannot appear more than once in the submission.');
    }
    if (submittedIds.some(id => !eligibleIds.has(id))) {
      throw new BadRequestException('Attendance can only be recorded for active students in this session roster.');
    }

    const records = await this.recordRepository.bulkCreate(
      sessionId,
      dto.records,
    );

    return {
      success: true,
      message: `${records.length} attendance records saved successfully.`,
      data: records,
    };
  }

  async getRecordsBySession(sessionId: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    await this.access.assertSessionAccess(sessionId, actor);
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(
        `Attendance session with ID ${sessionId} not found.`,
      );
    }

    const records = await this.recordRepository.findBySession(sessionId);
    return {
      success: true,
      message: 'Attendance records retrieved successfully.',
      data: records,
    };
  }

  async findOneRecord(id: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    const record = await this.recordRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${id} not found.`);
    }
    await this.access.assertSessionAccess(record.attendanceSessionId, actor);
    return {
      success: true,
      message: 'Attendance record retrieved successfully.',
      data: record,
    };
  }
}
