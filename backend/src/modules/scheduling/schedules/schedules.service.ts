import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplateRepository } from '../templates/repositories/template.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { TimetableImportService } from '../timetable-import/timetable-import.service';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

export interface ScheduleActor { id: string; role: string; }

@Injectable()
export class SchedulesService {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly timetableImportService: TimetableImportService,
  ) {}

  private async adminDepartment(actor: ScheduleActor): Promise<string> {
    if (!actor?.id || actor.role !== 'ADMIN') throw new ForbiddenException('Only ADMIN accounts can manage schedules.');
    const departmentId = await this.templateRepository.getAdminDepartmentId(actor.id);
    if (!departmentId) throw new ForbiddenException('An assigned department is required to manage schedules.');
    return departmentId;
  }

  async create(createScheduleDto: CreateScheduleDto, actor: ScheduleActor): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    await this.assertTemplateDepartment(createScheduleDto.templateId, departmentId);
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

  async getTodaySchedules(
    userId?: string,
    userRole?: string,
    queryFacultyId?: string,
    dateQuery?: string,
  ): Promise<ApiResponse<any>> {
    const now = new Date();
    const day = dateQuery || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date(day + 'T00:00:00.000Z');
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

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
    
    return {
      success: true,
      message: 'Schedules retrieved successfully.',
      data: schedules,
    };
  }

  async generate(generateDto: GenerateScheduleDto, actor: ScheduleActor): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    const start = new Date(generateDto.startDate);
    const end = new Date(generateDto.endDate);

    if (start > end) {
      throw new BadRequestException('Start date must be before or equal to end date.');
    }

    // Synchronize active slots before generating legacy template-only sections.
    const synced = await this.timetableImportService.syncTimetableToSchedules(
      undefined, generateDto.startDate, generateDto.endDate, undefined, departmentId,
    );
    const managedSections = new Set(synced.sectionIds);
    const templates = (await this.templateRepository.findAll(departmentId))
      .filter((template) => !managedSections.has(template.sectionId));
    const existingSchedules = await this.scheduleRepository.findByDateRange(start, end);
    const existingKeySet = new Set(
      existingSchedules.map((s) => `${s.templateId}_${s.lectureDate instanceof Date ? s.lectureDate.toISOString().slice(0, 10) : new Date(s.lectureDate).toISOString().slice(0, 10)}`)
    );

    const schedulesToCreate: any[] = [];

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      const dateStr = d.toISOString().slice(0, 10);
      
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.effectiveFrom <= d && (!t.effectiveTo || t.effectiveTo >= d));
      
      for (const t of dayTemplates) {
        const key = `${t.id}_${dateStr}`;
        if (!existingKeySet.has(key)) {
          existingKeySet.add(key);
          schedulesToCreate.push({
            templateId: t.id,
            lectureDate: new Date(d),
            status: 'SCHEDULED',
          });
        }
      }
    }

    if (schedulesToCreate.length === 0) {
      return { success: true, message: `${synced.schedulesCreated} schedules generated from active timetables; remaining schedules are already up to date.`, data: [] };
    }

    await this.scheduleRepository.createMany(schedulesToCreate);

    return {
      success: true,
      message: `${schedulesToCreate.length + synced.schedulesCreated} schedules generated successfully.`,
      data: null,
    };
  }

  private async assertTemplateDepartment(templateId: string, departmentId: string) {
    const template = await this.templateRepository.findById(templateId);
    if (!template) throw new NotFoundException('Schedule template not found.');
    const actual = await this.templateRepository.getSectionDepartmentId(template.sectionId);
    if (!actual || actual !== departmentId) {
      throw new ForbiddenException('You can only update schedules within your assigned department.');
    }
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto, actor: ScheduleActor): Promise<ApiResponse<any>> {
    if (!actor?.id || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN accounts can update schedules.');
    }
    const departmentId = await this.templateRepository.getAdminDepartmentId(actor.id);
    if (!departmentId) throw new ForbiddenException('An assigned department is required to update schedules.');
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found.`);
    }

    await this.assertTemplateDepartment(schedule.templateId, departmentId);
    if (updateScheduleDto.templateId !== undefined) {
      if (updateScheduleDto.templateId === null) throw new BadRequestException('templateId cannot be null.');
      if (updateScheduleDto.templateId !== schedule.templateId) {
        await this.assertTemplateDepartment(updateScheduleDto.templateId, departmentId);
      }
    }
    const updated = await this.scheduleRepository.update(id, updateScheduleDto);
    return {
      success: true,
      message: 'Schedule updated successfully.',
      data: updated,
    };
  }
}
