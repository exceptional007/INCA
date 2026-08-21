import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { RecordRepository } from '../records/repositories/record.repository';
import { SessionRepository } from '../sessions/repositories/session.repository';
import { EditRecordDto } from './dto/edit-record.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

const EDIT_WINDOW_HOURS = 24;

@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly recordRepository: RecordRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async editRecord(
    recordId: string,
    dto: EditRecordDto,
  ): Promise<ApiResponse<any>> {
    // 1. Load the record
    const record = await this.recordRepository.findById(recordId);
    if (!record) {
      throw new NotFoundException(
        `Attendance record with ID ${recordId} not found.`,
      );
    }

    // 2. Session must be SUBMITTED to allow edits
    const session = await this.sessionRepository.findById(
      record.attendanceSessionId,
    );
    if (!session) {
      throw new NotFoundException('Parent attendance session not found.');
    }
    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'The attendance session is still OPEN. Use the bulk-submit endpoint to update records on an open session.',
      );
    }

    // 3. Enforce 24-hour edit window from submittedAt
    if (!session.submittedAt) {
      throw new BadRequestException(
        'Session has no submittedAt timestamp — cannot determine edit window.',
      );
    }
    const hoursSinceSubmission =
      (Date.now() - session.submittedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSubmission > EDIT_WINDOW_HOURS) {
      throw new ForbiddenException(
        `The ${EDIT_WINDOW_HOURS}-hour edit window has expired. This attendance record can no longer be modified.`,
      );
    }

    // 4. No-op guard: if status is the same, skip the update
    if (record.status === dto.newStatus) {
      throw new BadRequestException(
        `The record already has status "${dto.newStatus}". No change made.`,
      );
    }

    // 5. Write the audit log FIRST (before updating record)
    const audit = await this.auditRepository.createAudit({
      attendanceRecordId: record.id,
      oldStatus: record.status,
      newStatus: dto.newStatus,
      editedById: dto.editedById,
      reason: dto.reason,
    });

    // 6. Update the record's status
    const updatedRecord = await this.recordRepository.update(record.id, {
      status: dto.newStatus,
      remarks: dto.reason ?? record.remarks,
    });

    return {
      success: true,
      message: 'Attendance record updated and audit logged successfully.',
      data: {
        record: updatedRecord,
        audit,
      },
    };
  }

  async getAuditsByRecord(recordId: string): Promise<ApiResponse<any>> {
    const record = await this.recordRepository.findById(recordId);
    if (!record) {
      throw new NotFoundException(
        `Attendance record with ID ${recordId} not found.`,
      );
    }

    const audits = await this.auditRepository.findByRecord(recordId);
    return {
      success: true,
      message: 'Audit trail retrieved successfully.',
      data: audits,
    };
  }

  async getAllAudits(): Promise<ApiResponse<any>> {
    const audits = await this.auditRepository.findAll();
    return {
      success: true,
      message: 'All attendance audits retrieved successfully.',
      data: audits,
    };
  }
}
