import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ConfigModule } from '@nestjs/config';
import { LostFoundController } from './lost-found.controller';
import { LostFoundService } from './lost-found.service';
import { LostFoundMatchingService } from './lost-found-matching.service';
import { LostFoundClaimService } from './lost-found-claim.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { LostFoundNotificationService } from './lost-found-notification.service';

@Module({
  imports: [PrismaModule, StorageModule, ConfigModule],
  controllers: [LostFoundController],
  providers: [
    LostFoundService,
    LostFoundMatchingService,
    LostFoundClaimService,
    LostFoundContributionService,
    LostFoundNotificationService,
  ],
  exports: [
    LostFoundService,
    LostFoundMatchingService,
    LostFoundClaimService,
    LostFoundContributionService,
    LostFoundNotificationService,
  ],
})
export class LostFoundModule {}

