import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionRepository } from './repositories/session.repository';
import { AttendanceAccessService } from './attendance-access.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionRepository, AttendanceAccessService],
  exports: [SessionsService, SessionRepository, AttendanceAccessService],
})
export class SessionsModule {}
