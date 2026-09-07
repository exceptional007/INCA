import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
