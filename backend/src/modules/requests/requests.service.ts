import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestStatus } from '@prisma/client';

@Injectable()
export class RequestsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.request.count();
    if (count === 0) {
      await this.prisma.request.createMany({
        data: [
          {
            title: 'Schedule Reschedule Request',
            details: 'Dr. Amit Roy - CS-301 slot shift from 10:00 AM to 11:30 AM',
            requester: 'Faculty HOD',
            status: RequestStatus.PENDING,
          },
          {
            title: 'Attendance Override Request',
            details: 'Prabin Barua (CSB23010) - Medical Leave approved',
            requester: 'Coordinator',
            status: RequestStatus.PENDING,
          },
        ],
      });
      console.log('Seeded sample requests in database.');
    }
  }

  async create(dto: { title: string; details: string; requester: string }) {
    return this.prisma.request.create({
      data: {
        title: dto.title,
        details: dto.details,
        requester: dto.requester,
        status: RequestStatus.PENDING,
      },
    });
  }

  async findAll(status?: RequestStatus) {
    return this.prisma.request.findMany({
      where: status ? { status } : {},
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, dto: { status: RequestStatus }) {
    const request = await this.prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found.`);
    }

    return this.prisma.request.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found.`);
    }

    return this.prisma.request.delete({
      where: { id },
    });
  }
}
