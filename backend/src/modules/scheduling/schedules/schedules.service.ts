import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplateRepository } from '../templates/repositories/template.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly templateRepository: TemplateRepository,
  ) {}

  async create(createScheduleDto: CreateScheduleDto): Promise<ApiResponse<any>> {
    const schedule = await this.scheduleRepository.create(createScheduleDto);
    return {
      success: true,
      message: 'Schedule created successfully.',
      data: schedule,
    };
  }

  async findAll(userId?: string, userRole?: string, queryFacultyId?: string): Promise<ApiResponse<any>> {
    let facultyId = queryFacultyId;
    let sectionIds: string[] | undefined = undefined;
    if (userRole === 'FACULTY') {
      const resolved = userId ? await this.scheduleRepository.getFacultyIdForUser(userId) : null;
      if (!resolved) {
        return {
          success: true,
          message: 'No schedules assigned for this faculty.',
          data: [],
        };
      }
      facultyId = resolved;
    } else if (userRole === 'STUDENT') {
      const resolvedSectionIds = userId ? await this.scheduleRepository.getStudentSectionIdsForUser(userId) : [];
      if (!resolvedSectionIds || resolvedSectionIds.length === 0) {
        return {
          success: true,
          message: 'No section assigned for this student.',
          data: [],
        };
      }
      sectionIds = resolvedSectionIds;
    }
    const schedules = await this.scheduleRepository.findAll(facultyId, sectionIds);
    return {
      success: true,
      message: 'Schedules retrieved successfully.',
      data: schedules,
    };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Schedule retrieved successfully.',
      data: schedule,
    };
  }

  async getTodaySchedules(userId?: string, userRole?: string, queryFacultyId?: string): Promise<ApiResponse<any>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let facultyId = queryFacultyId;
    let sectionIds: string[] | undefined = undefined;
    if (userRole === 'FACULTY') {
      const resolved = userId ? await this.scheduleRepository.getFacultyIdForUser(userId) : null;
      if (!resolved) {
        return {
          success: true,
          message: 'No schedules assigned for this faculty.',
          data: [],
        };
      }
      facultyId = resolved;
    } else if (userRole === 'STUDENT') {
      const resolvedSectionIds = userId ? await this.scheduleRepository.getStudentSectionIdsForUser(userId) : [];
      if (!resolvedSectionIds || resolvedSectionIds.length === 0) {
        return {
          success: true,
          message: 'No section assigned for this student.',
          data: [],
        };
      }
      sectionIds = resolvedSectionIds;
    }

    let schedules = await this.scheduleRepository.findByDateRange(today, tomorrow, facultyId, sectionIds);
    
    // If empty on local date boundary, try UTC day boundary
    if (schedules.length === 0) {
      const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const utcTomorrow = new Date(utcToday);
      utcTomorrow.setUTCDate(utcTomorrow.getUTCDate() + 1);
      schedules = await this.scheduleRepository.findByDateRange(utcToday, utcTomorrow, facultyId, sectionIds);
    }

    // If still empty (e.g. weekend, holiday or no schedule on exact today), fall back to active schedules for this section/faculty
    if (schedules.length === 0) {
      const allSchedules = await this.scheduleRepository.findAll(facultyId, sectionIds);
      schedules = allSchedules.slice(0, 10);
    }

    return {
      success: true,
      message: 'Today\'s schedules retrieved successfully.',
      data: schedules,
    };
  }

  async generate(generateDto: GenerateScheduleDto): Promise<ApiResponse<any>> {
    const start = new Date(generateDto.startDate);
    const end = new Date(generateDto.endDate);

    if (start > end) {
      throw new BadRequestException('Start date must be before or equal to end date.');
    }

    const templates = await this.templateRepository.findAll();
    const schedulesToCreate: any[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); 
      
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.effectiveFrom <= d && (!t.effectiveTo || t.effectiveTo >= d));
      
      for (const t of dayTemplates) {
        schedulesToCreate.push({
          templateId: t.id,
          lectureDate: new Date(d),
          status: 'SCHEDULED',
        });
      }
    }

    if (schedulesToCreate.length === 0) {
      return { success: true, message: 'No schedules to generate for this date range.', data: [] };
    }

    await this.scheduleRepository.createMany(schedulesToCreate);

    return {
      success: true,
      message: `${schedulesToCreate.length} schedules generated successfully.`,
      data: null,
    };
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto): Promise<ApiResponse<any>> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found.`);
    }

    const updated = await this.scheduleRepository.update(id, updateScheduleDto);
    return {
      success: true,
      message: 'Schedule updated successfully.',
      data: updated,
    };
  }
}
