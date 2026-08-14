import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { DepartmentRepository } from './repositories/department.repository';
import { AcademicService } from './academic.service';
import { ProgramRepository } from './repositories/program.repository';


@Module({
  controllers: [AcademicController],
  providers: [AcademicService, DepartmentRepository, ProgramRepository]
})
export class AcademicModule {}
