import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentRepository } from './repositories/department.repository';
import { ProgramRepository } from './repositories/program.repository';
import { BatchRepository } from './repositories/batch.repository';
import { SemesterRepository } from './repositories/semester.repository';
import { SectionRepository } from './repositories/section.repository';
import { SubjectRepository } from './repositories/subject.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class AcademicService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly programRepository: ProgramRepository,
    private readonly batchRepository: BatchRepository,
    private readonly semesterRepository: SemesterRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly subjectRepository: SubjectRepository,
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

  async createSemester(dto: CreateSemesterDto) {
    const program = await this.programRepository.findById(dto.programId);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException(
        'Cannot create a semester under an inactive program.',
      );
    }

    const batch = await this.batchRepository.findById(dto.batchId);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (!batch.isActive) {
      throw new ConflictException(
        'Cannot create a semester under an inactive batch.',
      );
    }

    if (batch.programId !== dto.programId) {
      throw new ConflictException(
        'Batch does not belong to the selected program.',
      );
    }

    const existingSemester = await this.semesterRepository.findByBatchAndNumber(
      dto.batchId,
      dto.number,
    );

    if (existingSemester) {
      throw new ConflictException(
        'This semester already exists for the selected batch.',
      );
    }

    return this.semesterRepository.create({
      programId: dto.programId,
      batchId: dto.batchId,
      number: dto.number,
      name: dto.name,
    });
  }

  async getAllSemesters() {
    return this.semesterRepository.findAll();
  }

  async getSemesterById(id: string) {
    const semester = await this.semesterRepository.findById(id);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    return semester;
  }

  async updateSemester(id: string, dto: UpdateSemesterDto) {
    const semester = await this.semesterRepository.findById(id);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    const programId = dto.programId ?? semester.programId;

    const batchId = dto.batchId ?? semester.batchId;

    const program = await this.programRepository.findById(programId);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException(
        'Cannot assign semester to an inactive program.',
      );
    }

    const batch = await this.batchRepository.findById(batchId);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (!batch.isActive) {
      throw new ConflictException(
        'Cannot assign semester to an inactive batch.',
      );
    }

    if (batch.programId !== programId) {
      throw new ConflictException(
        'Batch does not belong to the selected program.',
      );
    }

    const semesterNumber = dto.number ?? semester.number;

    const existingSemester = await this.semesterRepository.findByBatchAndNumber(
      batchId,
      semesterNumber,
    );

    if (existingSemester && existingSemester.id !== id) {
      throw new ConflictException(
        'This semester already exists for the selected batch.',
      );
    }

    return this.semesterRepository.update(id, dto);
  }

  async deactivateSemester(id: string) {
    const semester = await this.semesterRepository.findById(id);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    if (!semester.isActive) {
      throw new ConflictException('Semester is already inactive.');
    }

    return this.semesterRepository.deactivate(id);
  }

  async createSection(dto: CreateSectionDto) {
    const batch = await this.batchRepository.findById(dto.batchId);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (!batch.isActive) {
      throw new ConflictException(
        'Cannot create a section under an inactive batch.',
      );
    }

    const semester = await this.semesterRepository.findById(dto.semesterId);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    if (!semester.isActive) {
      throw new ConflictException(
        'Cannot create a section under an inactive semester.',
      );
    }

    if (semester.batchId !== dto.batchId) {
      throw new ConflictException(
        'Semester does not belong to the selected batch.',
      );
    }

    const existingSection =
      await this.sectionRepository.findByBatchSemesterAndName(
        dto.batchId,
        dto.semesterId,
        dto.name,
      );

    if (existingSection) {
      throw new ConflictException(
        'Section already exists for this batch and semester.',
      );
    }

    return this.sectionRepository.create({
      batchId: dto.batchId,
      semesterId: dto.semesterId,
      name: dto.name,
    });
  }

  async getAllSections() {
    return this.sectionRepository.findAll();
  }

  async getSectionById(id: string) {
    const section = await this.sectionRepository.findById(id);

    if (!section) {
      throw new NotFoundException('Section not found.');
    }

    return section;
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const section = await this.sectionRepository.findById(id);

    if (!section) {
      throw new NotFoundException('Section not found.');
    }

    const batchId = dto.batchId ?? section.batchId;

    const semesterId = dto.semesterId ?? section.semesterId;

    const batch = await this.batchRepository.findById(batchId);

    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    if (!batch.isActive) {
      throw new ConflictException(
        'Cannot assign section to an inactive batch.',
      );
    }

    const semester = await this.semesterRepository.findById(semesterId);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    if (!semester.isActive) {
      throw new ConflictException(
        'Cannot assign section to an inactive semester.',
      );
    }

    if (semester.batchId !== batchId) {
      throw new ConflictException(
        'Semester does not belong to the selected batch.',
      );
    }

    const name = dto.name ?? section.name;

    const existingSection =
      await this.sectionRepository.findByBatchSemesterAndName(
        batchId,
        semesterId,
        name,
      );

    if (existingSection && existingSection.id !== id) {
      throw new ConflictException(
        'Section already exists for this batch and semester.',
      );
    }

    return this.sectionRepository.update(id, dto);
  }

  async deactivateSection(id: string) {
    const section = await this.sectionRepository.findById(id);

    if (!section) {
      throw new NotFoundException('Section not found.');
    }

    if (!section.isActive) {
      throw new ConflictException('Section is already inactive.');
    }

    return this.sectionRepository.deactivate(id);
  }

  async createSubject(dto: CreateSubjectDto) {
    const program = await this.programRepository.findById(dto.programId);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException(
        'Cannot create a subject under an inactive program.',
      );
    }

    const semester = await this.semesterRepository.findById(dto.semesterId);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    if (!semester.isActive) {
      throw new ConflictException(
        'Cannot create a subject under an inactive semester.',
      );
    }

    if (semester.programId !== dto.programId) {
      throw new ConflictException(
        'Semester does not belong to the selected program.',
      );
    }

    const existingCode = await this.subjectRepository.findByCode(dto.code);

    if (existingCode) {
      throw new ConflictException('Subject code already exists.');
    }

    const existingSubject = await this.subjectRepository.findBySemesterAndName(
      dto.programId,
      dto.semesterId,
      dto.name,
    );

    if (existingSubject) {
      throw new ConflictException(
        'Subject already exists for this program and semester.',
      );
    }

    return this.subjectRepository.create({
      programId: dto.programId,
      semesterId: dto.semesterId,
      code: dto.code,
      name: dto.name,
      credits: dto.credits,
      isLab: dto.isLab,
    });
  }

  async getAllSubjects() {
    return this.subjectRepository.findAll();
  }

  async getSubjectById(id: string) {
    const subject = await this.subjectRepository.findById(id);

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    return subject;
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const subject = await this.subjectRepository.findById(id);

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    const programId = dto.programId ?? subject.programId;

    const semesterId = dto.semesterId ?? subject.semesterId;

    const program = await this.programRepository.findById(programId);

    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    if (!program.isActive) {
      throw new ConflictException(
        'Cannot assign subject to an inactive program.',
      );
    }

    const semester = await this.semesterRepository.findById(semesterId);

    if (!semester) {
      throw new NotFoundException('Semester not found.');
    }

    if (!semester.isActive) {
      throw new ConflictException(
        'Cannot assign subject to an inactive semester.',
      );
    }

    if (semester.programId !== programId) {
      throw new ConflictException(
        'Semester does not belong to the selected program.',
      );
    }

    if (dto.code && dto.code !== subject.code) {
      const existingCode = await this.subjectRepository.findByCode(dto.code);

      if (existingCode) {
        throw new ConflictException('Subject code already exists.');
      }
    }

    const name = dto.name ?? subject.name;

    const existingSubject = await this.subjectRepository.findBySemesterAndName(
      programId,
      semesterId,
      name,
    );

    if (existingSubject && existingSubject.id !== id) {
      throw new ConflictException(
        'Subject already exists for this program and semester.',
      );
    }

    return this.subjectRepository.update(id, dto);
  }

  async deactivateSubject(id: string) {
    const subject = await this.subjectRepository.findById(id);

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    if (!subject.isActive) {
      throw new ConflictException('Subject is already inactive.');
    }

    return this.subjectRepository.deactivate(id);
  }
}
