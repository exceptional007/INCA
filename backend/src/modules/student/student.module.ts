import { Module } from '@nestjs/common';
import { StudentRepository } from './repositories/student.repository';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';

@Module({
  controllers: [StudentController],
  providers: [StudentService, StudentRepository],
})
export class StudentModule {}
