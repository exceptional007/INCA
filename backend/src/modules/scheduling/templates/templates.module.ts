import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplateRepository } from './repositories/template.repository';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateRepository],
  exports: [TemplatesService, TemplateRepository],
})
export class TemplatesModule {}
