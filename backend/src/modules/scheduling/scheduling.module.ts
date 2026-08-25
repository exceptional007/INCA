import { Module } from '@nestjs/common';
import { TemplatesModule } from './templates/templates.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ExceptionsModule } from './exceptions/exceptions.module';
import { TimetableImportModule } from './timetable-import/timetable-import.module';

@Module({
  imports: [TemplatesModule, SchedulesModule, ExceptionsModule, TimetableImportModule],
})
export class SchedulingModule {}

