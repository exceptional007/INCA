import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RecordRepository } from './repositories/record.repository';
import { SessionRepository } from '../sessions/repositories/session.repository';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class RecordsService {
  constructor(
    private readonly recordRepository: RecordRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async submitRecords(
    sessionId: string,
    dto: SubmitAttendanceDto,
  ): Promise<ApiResponse<any>> {
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

  async getRecordsBySession(sessionId: string): Promise<ApiResponse<any>> {
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

  async findOneRecord(id: string): Promise<ApiResponse<any>> {
    const record = await this.recordRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Attendance record retrieved successfully.',
      data: record,
    };
  }
}
