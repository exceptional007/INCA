import { Module } from '@nestjs/common';
import { StudentRepository } from './repositories/student.repository';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { NoticesModule } from '../notices/notices.module';
import { StudentPortalService } from './student-portal.service';
import { StudentRegistrationService } from './student-registration.service';
import { AttendanceObjectionsService } from './attendance-objections.service';
import { StudentPortalController, AttendanceObjectionsController } from './student-portal.controller';

@Module({
  imports: [NoticesModule],
  controllers: [StudentController, StudentPortalController, AttendanceObjectionsController],
  providers: [StudentService, StudentRepository, StudentPortalService, AttendanceObjectionsService, StudentRegistrationService],
})
export class StudentModule {}
