import { Module } from '@nestjs/common';
import { TemplatesModule } from './templates/templates.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ExceptionsModule } from './exceptions/exceptions.module';

@Module({
  imports: [TemplatesModule, SchedulesModule, ExceptionsModule],
})
export class SchedulingModule {}
