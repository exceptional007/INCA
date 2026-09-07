import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StrictR2StorageService } from './strict-r2-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [StrictR2StorageService],
  exports: [StrictR2StorageService],
})
export class StorageModule {}
