import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { DepartmentRepository } from './repositories/department.repository';
import { AcademicService } from './academic.service';
import { ProgramRepository } from './repositories/program.repository';
import { BatchRepository } from './repositories/batch.repository';
import { SemesterRepository } from './repositories/semester.repository';
import { SectionRepository } from './repositories/section.repository';
import { SubjectRepository } from './repositories/subject.repository';
import { AcademicSessionRepository } from './repositories/academic-session.repository';
import { RoomRepository } from './repositories/room.repository';

@Module({
  controllers: [AcademicController],
  providers: [
    AcademicService,
    DepartmentRepository,
    ProgramRepository,
    BatchRepository,
    SemesterRepository,
    SectionRepository,
    SubjectRepository,
    AcademicSessionRepository,
    RoomRepository,
  ],
})
export class AcademicModule {}
