import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { ActivityRepository } from './repositories/activity.repository';

@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityTypeRepository, ActivityRepository],
  exports: [ActivitiesService, ActivityRepository, ActivityTypeRepository],
})
export class ActivitiesModule {}
