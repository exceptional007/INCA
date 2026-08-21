import {
  Injectable,
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

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activityTypeRepository: ActivityTypeRepository,
    private readonly activityRepository: ActivityRepository,
  ) {}

  // ─── Activity Types ────────────────────────────────────────────────────────

  async createActivityType(
    dto: CreateActivityTypeDto,
  ): Promise<ApiResponse<any>> {
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
  ): Promise<ApiResponse<any>> {
    await this.findOneActivityType(id);
    const updated = await this.activityTypeRepository.update(id, dto);
    return {
      success: true,
      message: 'Activity type updated successfully.',
      data: updated,
    };
  }

  async removeActivityType(id: string): Promise<ApiResponse<any>> {
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

  async createActivity(dto: CreateActivityDto): Promise<ApiResponse<any>> {
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

  async findActivitiesByFaculty(
    facultyId: string,
  ): Promise<ApiResponse<any>> {
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
  ): Promise<ApiResponse<any>> {
    await this.findOneActivity(id);

    // Validate time window if both provided
    if (dto.startTime && dto.endTime) {
      const start = new Date(dto.startTime);
      const end = new Date(dto.endTime);
      if (start >= end) {
        throw new BadRequestException('startTime must be before endTime.');
      }
    }

    const updated = await this.activityRepository.update(id, dto);
    return {
      success: true,
      message: 'Activity updated successfully.',
      data: updated,
    };
  }

  async removeActivity(id: string): Promise<ApiResponse<any>> {
    await this.findOneActivity(id);
    await this.activityRepository.remove(id);
    return {
      success: true,
      message: 'Activity deleted successfully.',
      data: null,
    };
  }
}
