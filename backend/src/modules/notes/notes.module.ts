import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { DocumentProcessingService } from './document-processing.service';
import { TutorService } from './tutor.service';
import { QuizService } from './quiz.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule],
  controllers: [NotesController],
  providers: [
    NotesService,
    DocumentProcessingService,
    TutorService,
    QuizService,
  ],
  exports: [
    NotesService,
    DocumentProcessingService,
    TutorService,
    QuizService,
  ],
})
export class NotesModule {}

