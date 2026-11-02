import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SessionRepository } from './repositories/session.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { AttendanceAccessService } from './attendance-access.service';
import type { AttendanceActor } from './attendance-access.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly access: AttendanceAccessService,
  ) {}

  async create(dto: CreateSessionDto, actor: AttendanceActor): Promise<ApiResponse<any>> {
    // Enforce: exactly one of scheduleId or activityId must be provided
    const hasSchedule = !!dto.scheduleId;
    const hasActivity = !!dto.activityId;

    if (!hasSchedule && !hasActivity) {
      throw new BadRequestException(
        'Either scheduleId or activityId must be provided.',
      );
    }
    if (hasSchedule && hasActivity) {
      throw new BadRequestException(
        'Provide either scheduleId or activityId — not both.',
      );
    }

    // Enforce: return existing session if already opened for this schedule/activity
    if (hasSchedule) {
      const existing = await this.sessionRepository.findBySchedule(
        dto.scheduleId!,
      );
      if (existing) {
        await this.access.assertSessionAccess(existing.id, actor, true);
        return {
          success: true,
          message: 'Existing attendance session retrieved.',
          data: existing,
        };
      }
    }

    if (hasActivity) {
      const existing = await this.sessionRepository.findByActivity(
        dto.activityId!,
      );
      if (existing) {
        await this.access.assertSessionAccess(existing.id, actor, true);
        return {
          success: true,
          message: 'Existing attendance session retrieved.',
          data: existing,
        };
      }
    }

    await this.access.assertSourceAccess(actor, dto);
    const takenById = await this.access.facultyIdForActor(actor);
    const session = await this.sessionRepository.create({ ...dto, takenById });
    return {
      success: true,
      message: 'Attendance session created successfully.',
      data: session,
    };
  }

  async findAll(actor: AttendanceActor): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findAll(await this.access.sessionScope(actor));
    return {
      success: true,
      message: 'Attendance sessions retrieved successfully.',
      data: sessions,
    };
  }

  async findOne(id: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    await this.access.assertSessionAccess(id, actor);
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Attendance session with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Attendance session retrieved successfully.',
      data: session,
    };
  }

  async findToday(actor: AttendanceActor): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findToday(await this.access.sessionScope(actor));
    return {
      success: true,
      message: "Today's attendance sessions retrieved successfully.",
      data: sessions,
    };
  }

  async getRoster(id: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    await this.access.assertSessionAccess(id, actor);
    const students = await this.sessionRepository.getRoster(id);
    return {
      success: true,
      message: 'Attendance roster retrieved successfully.',
      data: students,
    };
  }

  async findByFaculty(facultyId: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findByFaculty(facultyId, await this.access.sessionScope(actor));
    return {
      success: true,
      message: 'Faculty attendance sessions retrieved successfully.',
      data: sessions,
    };
  }

  async findForUser(actor: AttendanceActor): Promise<ApiResponse<any>> {
    return this.findAll(actor);
  }

  async submitSession(id: string, actor: AttendanceActor): Promise<ApiResponse<any>> {
    await this.access.assertSessionAccess(id, actor, true);
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Attendance session with ID ${id} not found.`);
    }
    if (session.status === 'SUBMITTED') {
      throw new BadRequestException('This session has already been submitted.');
    }

    const submitted = await this.sessionRepository.submit(id);
    return {
      success: true,
      message: 'Attendance session submitted and locked successfully.',
      data: submitted,
    };
  }
}
