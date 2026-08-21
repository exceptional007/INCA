import { Module } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionRepository } from './repositories/exception.repository';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [SchedulesModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService, ExceptionRepository],
  exports: [ExceptionsService, ExceptionRepository],
})
export class ExceptionsModule {}
