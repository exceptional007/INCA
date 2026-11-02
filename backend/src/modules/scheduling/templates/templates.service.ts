import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TemplateRepository } from './repositories/template.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

export interface ScheduleTemplateActor {
  id: string;
  role: string;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly templateRepository: TemplateRepository) {}

  private async adminDepartment(actor: ScheduleTemplateActor): Promise<string> {
    if (!actor?.id || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN accounts can modify schedule templates.');
    }
    const departmentId = await this.templateRepository.getAdminDepartmentId(actor.id);
    if (!departmentId) throw new ForbiddenException('An assigned department is required to manage schedule templates.');
    return departmentId;
  }

  private async assertSectionDepartment(sectionId: string, departmentId: string) {
    const sectionDepartment = await this.templateRepository.getSectionDepartmentId(sectionId);
    if (!sectionDepartment) throw new NotFoundException('Section not found.');
    if (sectionDepartment !== departmentId) {
      throw new ForbiddenException('You can only modify schedule templates within your assigned department.');
    }
  }

  private async validateReferences(dto: UpdateTemplateDto) {
    const references = [
      ['subjectId', 'Subject', (id: string) => this.templateRepository.subjectExists(id)],
      ['facultyId', 'Faculty', (id: string) => this.templateRepository.facultyExists(id)],
      ['roomId', 'Room', (id: string) => this.templateRepository.roomExists(id)],
    ] as const;
    for (const [field, label, exists] of references) {
      const id = dto[field];
      if (id === undefined) continue;
      if (id === null) throw new BadRequestException(`${field} cannot be null.`);
      if (!(await exists(id))) throw new NotFoundException(`${label} with ID ${id} not found.`);
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    const minutes = (value: string) => {
      if (typeof value !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        throw new BadRequestException('Times must be in HH:mm format.');
      }
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };
    if (minutes(startTime) >= minutes(endTime)) {
      throw new BadRequestException('startTime must be before endTime.');
    }
  }

  private validateEffectiveRange(effectiveFrom: string | Date, effectiveTo?: string | Date | null) {
    const day = (value: string | Date) => {
      const time = value == null ? NaN : new Date(value).getTime();
      if (!Number.isFinite(time)) throw new BadRequestException('Effective dates must be valid dates.');
      // Prisma stores these fields as Postgres DATE, discarding the UTC time.
      return Math.floor(time / 86_400_000);
    };
    const from = day(effectiveFrom);
    if (effectiveTo != null && day(effectiveTo) < from) {
      throw new BadRequestException('effectiveTo must be on or after effectiveFrom.');
    }
  }

  async create(createTemplateDto: CreateTemplateDto, actor: ScheduleTemplateActor): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    await this.assertSectionDepartment(createTemplateDto.sectionId, departmentId);
    this.validateTimeRange(createTemplateDto.startTime, createTemplateDto.endTime);
    this.validateEffectiveRange(createTemplateDto.effectiveFrom, createTemplateDto.effectiveTo);
    await this.validateReferences(createTemplateDto);
    const template = await this.templateRepository.create(createTemplateDto);
    return {
      success: true,
      message: 'Schedule template created successfully.',
      data: template,
    };
  }

  async findAll(): Promise<ApiResponse<any>> {
    const templates = await this.templateRepository.findAll();
    return {
      success: true,
      message: 'Schedule templates retrieved successfully.',
      data: templates,
    };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException(`Schedule template with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Schedule template retrieved successfully.',
      data: template,
    };
  }

  async findBySection(sectionId: string): Promise<ApiResponse<any>> {
    const templates = await this.templateRepository.findBySection(sectionId);
    return {
      success: true,
      message: 'Schedule templates for section retrieved successfully.',
      data: templates,
    };
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto, actor: ScheduleTemplateActor): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException(`Schedule template with ID ${id} not found.`);
    }

    await this.assertSectionDepartment(template.sectionId, departmentId);
    if (updateTemplateDto.sectionId && updateTemplateDto.sectionId !== template.sectionId) {
      await this.assertSectionDepartment(updateTemplateDto.sectionId, departmentId);
    }
    if (updateTemplateDto.startTime !== undefined || updateTemplateDto.endTime !== undefined) {
      this.validateTimeRange(
        updateTemplateDto.startTime !== undefined ? updateTemplateDto.startTime : template.startTime,
        updateTemplateDto.endTime !== undefined ? updateTemplateDto.endTime : template.endTime,
      );
    }
    if (updateTemplateDto.effectiveFrom !== undefined || updateTemplateDto.effectiveTo !== undefined) {
      this.validateEffectiveRange(
        updateTemplateDto.effectiveFrom !== undefined ? updateTemplateDto.effectiveFrom : template.effectiveFrom,
        updateTemplateDto.effectiveTo ?? template.effectiveTo,
      );
    }
    await this.validateReferences(updateTemplateDto);
    const updated = await this.templateRepository.update(id, updateTemplateDto);
    return {
      success: true,
      message: 'Schedule template updated successfully.',
      data: updated,
    };
  }

  async remove(id: string, actor: ScheduleTemplateActor): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException(`Schedule template with ID ${id} not found.`);
    }

    await this.assertSectionDepartment(template.sectionId, departmentId);
    await this.templateRepository.remove(id, template.sectionId);
    return {
      success: true,
      message: 'Schedule template deleted successfully.',
      data: null,
    };
  }
}
