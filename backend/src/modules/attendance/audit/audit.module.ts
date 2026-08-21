import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditRepository } from './repositories/audit.repository';
import { SessionsModule } from '../sessions/sessions.module';
import { RecordsModule } from '../records/records.module';

@Module({
  imports: [SessionsModule, RecordsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
