import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateActivityTypeDto } from '../dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from '../dto/update-activity-type.dto';

@Injectable()
export class ActivityTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.activityType.findMany({
      include: { _count: { select: { activities: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.activityType.findUnique({
      where: { id },
      include: { activities: true },
    });
  }

  async create(data: CreateActivityTypeDto) {
    return this.prisma.activityType.create({ data });
  }

  async update(id: string, data: UpdateActivityTypeDto) {
    return this.prisma.activityType.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.activityType.delete({ where: { id } });
  }
}
