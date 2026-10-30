import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryCacheService } from '../../../common/cache/memory-cache.service';

@Injectable()
export class DepartmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: MemoryCacheService,
  ) {}

  async findAll(includeInactive: boolean = false) {
    const key = `academic:departments:includeInactive=${includeInactive}`;
    const loader = () =>
      this.prisma.department.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: {
          name: 'asc',
        },
      });

    return this.cache ? this.cache.getOrSet(key, 600, loader) : loader();
  }

  async findById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.department.findUnique({
      where: { code },
    });
  }

  async create(data: {
    code: string;
    name: string;
    shortName?: string;
    description?: string;
  }) {
    return this.prisma.department.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      code?: string;
      name?: string;
      shortName?: string;
      description?: string;
    },
  ) {
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.department.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async activate(id: string) {
    return this.prisma.department.update({
      where: { id },
      data: {
        isActive: true,
      },
    });
  }
}
