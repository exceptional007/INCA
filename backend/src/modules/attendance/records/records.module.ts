import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { RecordRepository } from './repositories/record.repository';
import { SessionsModule } from '../sessions/sessions.module';
import { OfflineAttendanceController } from './offline-attendance.controller';
import { OfflineAttendanceService } from './offline-attendance.service';

@Module({
  imports: [SessionsModule],
  controllers: [RecordsController, OfflineAttendanceController],
  providers: [RecordsService, RecordRepository, OfflineAttendanceService],
  exports: [RecordsService, RecordRepository],
})
export class RecordsModule {}
