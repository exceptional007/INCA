import { Module } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplatesModule } from '../templates/templates.module';

import { TimetableImportModule } from '../timetable-import/timetable-import.module';

@Module({
  imports: [TemplatesModule, TimetableImportModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleRepository],
  exports: [SchedulesService, ScheduleRepository],
})
export class SchedulesModule {}
