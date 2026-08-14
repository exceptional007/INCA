import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentRepository } from './repositories/department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class AcademicService {
  constructor(private readonly departmentRepository: DepartmentRepository) {}

  async createDepartment(dto: CreateDepartmentDto) {
    const existingCode = await this.departmentRepository.findByCode(dto.code);

    if (existingCode) {
      throw new ConflictException('Department code already exists.');
    }

    return this.departmentRepository.create({
      code: dto.code,
      name: dto.name ?? '',
      shortName: dto.shortName ?? '',
      description: dto.description ?? '',
    });
  }

  async getAllDepartments() {
    return this.departmentRepository.findAll();
  }

  async getDepartmentById(id: string) {
    const department = await this.departmentRepository.findById(id);

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    return department;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const department = await this.departmentRepository.findById(id);

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    if (dto.code && dto.code !== department.code) {
      const existingCode = await this.departmentRepository.findByCode(dto.code);

      if (existingCode) {
        throw new ConflictException('Department code already exists.');
      }
    }

    return this.departmentRepository.update(id, dto);
  }
  async deactivateDepartment(id: string) {
    const department = await this.departmentRepository.findById(id);

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    if (!department.isActive) {
      throw new ConflictException('Department is already inactive.');
    }

    return this.departmentRepository.deactivate(id);
  }
}
