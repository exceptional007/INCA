import { Module } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [TemplatesModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleRepository],
  exports: [SchedulesService, ScheduleRepository],
})
export class SchedulesModule {}
