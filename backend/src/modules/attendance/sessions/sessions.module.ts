import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionRepository } from './repositories/session.repository';
import { AttendanceAccessService } from './attendance-access.service';
import { LateAttendanceService } from './late-attendance.service';
import { LateAttendanceController } from './late-attendance.controller';

@Module({
  controllers: [SessionsController, LateAttendanceController],
  providers: [SessionsService, SessionRepository, AttendanceAccessService, LateAttendanceService],
  exports: [SessionsService, SessionRepository, AttendanceAccessService],
})
export class SessionsModule {}
