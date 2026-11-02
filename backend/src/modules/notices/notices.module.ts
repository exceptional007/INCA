import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NoticePublicationService } from './notice-publication.service';
import { ConfigModule } from '@nestjs/config';
import { NoticeEnrichmentService } from './notice-enrichment.service';

@Module({
  imports: [PrismaModule, StorageModule, ConfigModule],
  controllers: [NoticesController],
  providers: [NoticesService, NoticePublicationService, NoticeEnrichmentService],
  exports: [NoticesService],
})
export class NoticesModule {}

