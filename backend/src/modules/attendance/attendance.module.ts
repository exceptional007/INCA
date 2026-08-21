import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { RecordsModule } from './records/records.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [SessionsModule, RecordsModule, AuditModule],
  exports: [SessionsModule, RecordsModule, AuditModule],
})
export class AttendanceModule {}
