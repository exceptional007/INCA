import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { RecordRepository } from './repositories/record.repository';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  controllers: [RecordsController],
  providers: [RecordsService, RecordRepository],
  exports: [RecordsService, RecordRepository],
})
export class RecordsModule {}
