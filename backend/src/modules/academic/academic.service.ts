import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentRepository } from './repositories/department.repository';
import { ProgramRepository } from './repositories/program.repository';
import { BatchRepository } from './repositories/batch.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Injectable()
export class AcademicService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly programRepository: ProgramRepository,
    private readonly batchRepository: BatchRepository,
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

  async createBatch(dto: CreateBatchDto) {
    const program = await this.programRepository.findById(dto.programId);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException(
        'Cannot create a batch under an inactive program.',
      );
    }

    if (dto.endYear <= dto.startYear) {
      throw new ConflictException('End year must be greater than start year.');
    }

    const existingBatch = await this.batchRepository.findByProgramAndStartYear(
      dto.programId,
      dto.startYear,
    );

    if (existingBatch) {
      throw new ConflictException(
        'Batch already exists for this program and start year.',
      );
    }

    return this.batchRepository.create({
      programId: dto.programId,
      name: dto.name,
      startYear: dto.startYear,
      endYear: dto.endYear,
    });
  }

  async getAllBatches() {
    return this.batchRepository.findAll();
  }

  async getBatchById(id: string) {
    const batch = await this.batchRepository.findById(id);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    return batch;
  }
  async updateBatch(id: string, dto: UpdateBatchDto) {
    const batch = await this.batchRepository.findById(id);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (dto.programId) {
      const program = await this.programRepository.findById(dto.programId);

      if (!program) {
        throw new NotFoundException('Program not found.');
      }

      if (!program.isActive) {
        throw new ConflictException(
          'Cannot move batch to an inactive program.',
        );
      }
    }

    const startYear = dto.startYear ?? batch.startYear;

    const endYear = dto.endYear ?? batch.endYear;

    if (endYear <= startYear) {
      throw new ConflictException('End year must be greater than start year.');
    }

    return this.batchRepository.update(id, dto);
  }

  async deactivateBatch(id: string) {
    const batch = await this.batchRepository.findById(id);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (!batch.isActive) {
      throw new ConflictException('Batch is already inactive.');
    }

    return this.batchRepository.deactivate(id);
  }
}
