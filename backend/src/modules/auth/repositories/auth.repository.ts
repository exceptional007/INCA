import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        adminProfile: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async updatePassword(userId: string, password: string) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password,
        mustChangePassword: false,
      },
    });
  }

  async findRoleById(roleId: string) {
    return this.prisma.role.findUnique({
      where: { id: roleId },
    });
  }

  async findRoleByCode(code: string) {
    return this.prisma.role.findUnique({
      where: { code },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
      },
    });
  }

  async createUser(data: { email: string; password: string; roleId: string }) {
    return this.prisma.user.create({
      data,
      include: {
        role: true,
      },
    });
  }

  async findCoordinators() {
    return this.prisma.user.findMany({
      where: {
        role: {
          code: 'COORDINATOR',
        },
      },
      include: {
        role: true,
      },
      orderBy: {
        email: 'asc',
      },
    });
  }

  async updateUser(id: string, data: { email?: string; password?: string; isActive?: boolean }) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
      },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findDepartmentById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
    });
  }

  async findAdmins() {
    return this.prisma.user.findMany({
      where: {
        role: {
          code: 'ADMIN',
        },
      },
      include: {
        role: true,
        adminProfile: {
          include: {
            department: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAdminById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        adminProfile: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async createAdminUser(data: {
    email: string;
    password: string;
    roleId: string;
    name: string;
    departmentId: string;
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        roleId: data.roleId,
        isActive: true,
        mustChangePassword: true,
        adminProfile: {
          create: {
            name: data.name,
            departmentId: data.departmentId,
          },
        },
      },
      include: {
        role: true,
        adminProfile: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async updateAdminProfile(
    userId: string,
    data: { name?: string; departmentId?: string },
  ) {
    return this.prisma.adminProfile.upsert({
      where: { userId },
      create: {
        userId,
        name: data.name || 'Admin',
        departmentId: data.departmentId || '',
      },
      update: data,
      include: {
        department: true,
      },
    });
  }

  async createAuditLog(data: { event: string; details: string }) {
    return this.prisma.systemAuditLog.create({
      data,
    });
  }
}

