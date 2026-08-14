import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AcademicRepository {
  constructor(private readonly prisma: PrismaService) {}
}