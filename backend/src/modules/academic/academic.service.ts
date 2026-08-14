import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentRepository } from './repositories/department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramRepository } from './repositories/program.repository';

@Injectable()
export class AcademicService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly programRepository: ProgramRepository,
  ) {}

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

  async createProgram(dto: CreateProgramDto) {
    const department = await this.departmentRepository.findById(
      dto.departmentId,
    );

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    if (!department.isActive) {
      throw new ConflictException(
        'Cannot create a program under an inactive department.',
      );
    }

    const existingCode = await this.programRepository.findByCode(dto.code);

    if (existingCode) {
      throw new ConflictException('Program code already exists.');
    }

    const existingName = await this.programRepository.findByName(
      dto.departmentId,
      dto.name,
    );

    if (existingName) {
      throw new ConflictException('Program already exists in this department.');
    }

    return this.programRepository.create({
      departmentId: dto.departmentId,
      code: dto.code,
      name: dto.name,
      shortName: dto.shortName,
      durationYears: dto.durationYears,
    });
  }

  async getAllPrograms() {
    return this.programRepository.findAll();
  }

  async getProgramById(id: string) {
    const program = await this.programRepository.findById(id);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    return program;
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    const program = await this.programRepository.findById(id);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (dto.departmentId) {
      const department = await this.departmentRepository.findById(
        dto.departmentId,
      );

      if (!department) {
        throw new NotFoundException('Department not found.');
      }

      if (!department.isActive) {
        throw new ConflictException(
          'Cannot move program to an inactive department.',
        );
      }
    }

    if (dto.code && dto.code !== program.code) {
      const existingCode = await this.programRepository.findByCode(dto.code);

      if (existingCode) {
        throw new ConflictException('Program code already exists.');
      }
    }

    return this.programRepository.update(id, dto);
  }

  async deactivateProgram(id: string) {
    const program = await this.programRepository.findById(id);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException('Program is already inactive.');
    }

    return this.programRepository.deactivate(id);
  }
}
