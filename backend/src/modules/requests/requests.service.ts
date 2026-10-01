import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestStatus } from '@prisma/client';

@Injectable()
export class RequestsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.request.count();
    if (count === 0) {
      const faculties = await this.prisma.faculty.findMany({ include: { department: true }, take: 3 });
      const students = await this.prisma.student.findMany({ include: { department: true }, take: 3 });

      const fac1 = faculties[0];
      const stud1 = students[0];

      if (fac1 && stud1) {
        await this.prisma.request.createMany({
          data: [
            {
              title: 'Schedule Reschedule Request',
              details: `${fac1.firstName} ${fac1.lastName || ''} (${fac1.employeeCode}) - CS-301 slot shift from 09:00 AM to 11:30 AM`,
              requester: `HOD (${fac1.department?.shortName || 'CSE'})`,
              status: RequestStatus.PENDING,
            },
            {
              title: 'Attendance Override Request',
              details: `${stud1.firstName} ${stud1.lastName || ''} (${stud1.rollNumber}) - Duty Leave approval for Inter-College Hackathon`,
              requester: `Academic Coordinator (${stud1.department?.shortName || 'CSE'})`,
              status: RequestStatus.PENDING,
            },
          ],
        });
        console.log('Seeded real DB-backed requests in database.');
      }
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
