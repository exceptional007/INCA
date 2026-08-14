import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { DepartmentRepository } from './repositories/department.repository';
import { AcademicService } from './academic.service';


@Module({
  controllers: [AcademicController],
  providers: [AcademicService, DepartmentRepository]
})
export class AcademicModule {}
