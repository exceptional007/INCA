import { Module } from '@nestjs/common';

import { FacultyController } from './faculty.controller';
import { FacultyService } from './faculty.service';
import { FacultyRepository } from './repositories/faculty.repository';

@Module({
  controllers: [FacultyController],
  providers: [
    FacultyService,
    FacultyRepository,
  ],
})
export class FacultyModule {}