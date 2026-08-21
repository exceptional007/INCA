import { Injectable, NotFoundException } from '@nestjs/common';
import { TemplateRepository } from './repositories/template.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class TemplatesService {
  constructor(private readonly templateRepository: TemplateRepository) {}

  async create(createTemplateDto: CreateTemplateDto): Promise<ApiResponse<any>> {
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

  async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<ApiResponse<any>> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException(`Schedule template with ID ${id} not found.`);
    }

    const updated = await this.templateRepository.update(id, updateTemplateDto);
    return {
      success: true,
      message: 'Schedule template updated successfully.',
      data: updated,
    };
  }

  async remove(id: string): Promise<ApiResponse<any>> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException(`Schedule template with ID ${id} not found.`);
    }

    await this.templateRepository.remove(id);
    return {
      success: true,
      message: 'Schedule template deleted successfully.',
      data: null,
    };
  }
}
