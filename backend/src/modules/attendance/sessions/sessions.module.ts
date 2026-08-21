import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionRepository } from './repositories/session.repository';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionRepository],
  exports: [SessionsService, SessionRepository],
})
export class SessionsModule {}
