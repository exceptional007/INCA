import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { ActivityRepository } from './repositories/activity.repository';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ApiResponse } from '../../common/interfaces/api-response.interface';

export interface ActivityActor {
  id: string;
  role: string;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activityTypeRepository: ActivityTypeRepository,
    private readonly activityRepository: ActivityRepository,
  ) {}

  private assertRole(actor: ActivityActor, roles: string[]) {
    if (!actor?.id || !roles.includes(actor.role))
      throw new ForbiddenException(
        'You are not allowed to modify these activities.',
      );
  }
  private async managementDepartment(
    actor: ActivityActor,
  ): Promise<string | null> {
    this.assertRole(actor, ['ADMIN', 'FACULTY']);
    if (actor.role === 'FACULTY') return null;
    const departmentId = await this.activityRepository.getAdminDepartmentId(
      actor.id,
    );
    if (!departmentId)
      throw new ForbiddenException('An assigned department is required.');
    return departmentId;
  }
  private async assertOrganiser(
    facultyId: string,
    actor: ActivityActor,
    departmentId: string | null,
  ) {
    const faculty = await this.activityRepository.getFacultyAccess(facultyId);
    if (!faculty) throw new NotFoundException('Faculty organiser not found.');
    if (
      actor.role === 'FACULTY'
        ? faculty.userId !== actor.id
        : !departmentId || faculty.departmentId !== departmentId
    ) {
      throw new ForbiddenException(
        'You can only manage your own activities or activities within your assigned admin department.',
      );
    }
  }

  private async validateRoom(roomId: string | null | undefined) {
    if (roomId == null) return;
    if (!(await this.activityRepository.roomExists(roomId))) {
      throw new NotFoundException(`Room with ID ${roomId} not found.`);
    }
  }

  // ─── Activity Types ────────────────────────────────────────────────────────

  async createActivityType(
    dto: CreateActivityTypeDto,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    this.assertRole(actor, ['ADMIN']);
    const activityType = await this.activityTypeRepository.create(dto);
    return {
      success: true,
      message: 'Activity type created successfully.',
      data: activityType,
    };
  }

  async findAllActivityTypes(): Promise<ApiResponse<any>> {
    const types = await this.activityTypeRepository.findAll();
    return {
      success: true,
      message: 'Activity types retrieved successfully.',
      data: types,
    };
  }

  async findOneActivityType(id: string): Promise<ApiResponse<any>> {
    const type = await this.activityTypeRepository.findById(id);
    if (!type) {
      throw new NotFoundException(`Activity type with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Activity type retrieved successfully.',
      data: type,
    };
  }

  async updateActivityType(
    id: string,
    dto: UpdateActivityTypeDto,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    this.assertRole(actor, ['ADMIN']);
    await this.findOneActivityType(id);
    const updated = await this.activityTypeRepository.update(id, dto);
    return {
      success: true,
      message: 'Activity type updated successfully.',
      data: updated,
    };
  }

  async removeActivityType(
    id: string,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    this.assertRole(actor, ['ADMIN']);
    const type = await this.activityTypeRepository.findById(id);
    if (!type) {
      throw new NotFoundException(`Activity type with ID ${id} not found.`);
    }
    if (type.activities.length > 0) {
      throw new ConflictException(
        `Cannot delete activity type that has ${type.activities.length} associated activities. Reassign or delete those activities first.`,
      );
    }
    await this.activityTypeRepository.remove(id);
    return {
      success: true,
      message: 'Activity type deleted successfully.',
      data: null,
    };
  }

  // ─── Activities ────────────────────────────────────────────────────────────

  async createActivity(
    dto: CreateActivityDto,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.managementDepartment(actor);
    await this.assertOrganiser(dto.facultyId, actor, departmentId);
    // Validate activity type exists
    const type = await this.activityTypeRepository.findById(dto.activityTypeId);
    if (!type) {
      throw new NotFoundException(
        `Activity type with ID ${dto.activityTypeId} not found.`,
      );
    }

    // Validate time window
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime.');
    }

    await this.validateRoom(dto.roomId);
    const activity = await this.activityRepository.create(dto);
    return {
      success: true,
      message: 'Activity created successfully.',
      data: activity,
    };
  }

  async findAllActivities(): Promise<ApiResponse<any>> {
    const activities = await this.activityRepository.findAll();
    return {
      success: true,
      message: 'Activities retrieved successfully.',
      data: activities,
    };
  }

  async findUpcomingActivities(): Promise<ApiResponse<any>> {
    const activities = await this.activityRepository.findUpcoming();
    return {
      success: true,
      message: 'Upcoming activities retrieved successfully.',
      data: activities,
    };
  }

  async findActivitiesByFaculty(facultyId: string): Promise<ApiResponse<any>> {
    const activities = await this.activityRepository.findByFaculty(facultyId);
    return {
      success: true,
      message: 'Faculty activities retrieved successfully.',
      data: activities,
    };
  }

  async findOneActivity(id: string): Promise<ApiResponse<any>> {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Activity retrieved successfully.',
      data: activity,
    };
  }

  async updateActivity(
    id: string,
    dto: UpdateActivityDto,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.managementDepartment(actor);
    const { data: activity } = await this.findOneActivity(id);
    await this.assertOrganiser(activity.facultyId, actor, departmentId);

    if (dto.facultyId && dto.facultyId !== activity.facultyId)
      await this.assertOrganiser(dto.facultyId, actor, departmentId);

    if (dto.activityTypeId !== undefined) {
      if (dto.activityTypeId === null) {
        throw new BadRequestException('activityTypeId cannot be null.');
      }
      await this.findOneActivityType(dto.activityTypeId);
    }

    // Validate the resulting window, including the stored timestamp on partial updates.
    if (dto.startTime != null || dto.endTime != null) {
      const start = new Date(dto.startTime ?? activity.startTime).getTime();
      const end = new Date(dto.endTime ?? activity.endTime).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
        throw new BadRequestException('startTime must be before endTime.');
      }
    }

    await this.validateRoom(dto.roomId);
    const updated = await this.activityRepository.update(id, dto);
    return {
      success: true,
      message: 'Activity updated successfully.',
      data: updated,
    };
  }

  async removeActivity(
    id: string,
    actor: ActivityActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.managementDepartment(actor);
    const { data: activity } = await this.findOneActivity(id);
    await this.assertOrganiser(activity.facultyId, actor, departmentId);
    await this.activityRepository.remove(id, activity.facultyId);
    return {
      success: true,
      message: 'Activity deleted successfully.',
      data: null,
    };
  }
}
