import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceMediaController } from './marketplace-media.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceChatService } from './marketplace-chat.service';
import { MarketplaceNegotiationService } from './marketplace-negotiation.service';
import { MarketplaceTransactionService } from './marketplace-transaction.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { MarketplaceGateway } from './marketplace.gateway';

@Module({
  imports: [ConfigModule, AuthModule, StorageModule, PrismaModule],
  controllers: [MarketplaceController, MarketplaceMediaController],
  providers: [
    MarketplaceService,
    MarketplaceChatService,
    MarketplaceNegotiationService,
    MarketplaceTransactionService,
    MarketplaceReviewService,
    MarketplaceModerationService,
    MarketplaceGateway,
  ],
  exports: [MarketplaceService, MarketplaceGateway],
})
export class MarketplaceModule {}
