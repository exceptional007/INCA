import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SessionRepository } from './repositories/session.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class SessionsService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async create(dto: CreateSessionDto): Promise<ApiResponse<any>> {
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

    // Enforce: no duplicate session for the same schedule/activity
    if (hasSchedule) {
      const existing = await this.sessionRepository.findBySchedule(
        dto.scheduleId!,
      );
      if (existing) {
        throw new ConflictException(
          'An attendance session already exists for this schedule.',
        );
      }
    }

    if (hasActivity) {
      const existing = await this.sessionRepository.findByActivity(
        dto.activityId!,
      );
      if (existing) {
        throw new ConflictException(
          'An attendance session already exists for this activity.',
        );
      }
    }

    const session = await this.sessionRepository.create(dto);
    return {
      success: true,
      message: 'Attendance session created successfully.',
      data: session,
    };
  }

  async findAll(): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findAll();
    return {
      success: true,
      message: 'Attendance sessions retrieved successfully.',
      data: sessions,
    };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
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

  async findToday(): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findToday();
    return {
      success: true,
      message: "Today's attendance sessions retrieved successfully.",
      data: sessions,
    };
  }

  async findByFaculty(facultyId: string): Promise<ApiResponse<any>> {
    const sessions = await this.sessionRepository.findByFaculty(facultyId);
    return {
      success: true,
      message: 'Faculty attendance sessions retrieved successfully.',
      data: sessions,
    };
  }

  async submitSession(id: string): Promise<ApiResponse<any>> {
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
