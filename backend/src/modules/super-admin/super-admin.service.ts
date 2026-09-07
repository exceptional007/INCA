import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateAdminDto } from '../auth/dto/create-admin.dto';
import { UpdateAdminDto } from '../auth/dto/update-admin.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getStats() {
    const totalAdmins = await this.prisma.user.count({
      where: {
        role: {
          code: 'ADMIN',
        },
        isActive: true,
      },
    });

    const totalActiveUsers = await this.prisma.user.count({
      where: { isActive: true },
    });

    // Distinct connected/assigned departments from active Admin profiles
    const distinctDepts = await this.prisma.adminProfile.findMany({
      where: {
        user: { isActive: true },
        department: { isActive: true },
      },
      select: { departmentId: true },
      distinct: ['departmentId'],
    });
    const connectedDeptsCount = distinctDepts.length;

    // Real system health check (Database ping & response latency)
    const startTime = Date.now();
    let isHealthy = false;
    let latencyMs = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      latencyMs = Date.now() - startTime;
      isHealthy = true;
    } catch {
      isHealthy = false;
    }

    return {
      connectedDepartments: {
        count: connectedDeptsCount,
        subtitle: connectedDeptsCount > 0
          ? `${connectedDeptsCount} active departments assigned`
          : 'No departments assigned yet',
      },
      // Backward compatibility alias for any existing consumer
      connectedInstitutions: {
        count: connectedDeptsCount,
        subtitle: connectedDeptsCount > 0
          ? `${connectedDeptsCount} active departments assigned`
          : 'No departments assigned yet',
      },
      totalActiveUsers: {
        count: totalActiveUsers,
        subtitle: 'Platform-wide active accounts',
      },
      systemHealth: {
        status: isHealthy ? 'Operational' : 'Degraded',
        latencyMs,
        uptimePercentage: null,
        subtitle: isHealthy
          ? `DB Live Latency: ${latencyMs}ms`
          : 'Database connection unavailable',
      },
      totalAdmins: {
        count: totalAdmins,
        subtitle: 'Active administrator accounts',
      },
    };
  }

  async getAdmins(actorRoleCode = 'SUPER_ADMIN') {
    return this.authService.getAdmins(actorRoleCode);
  }

  async createAdmin(creatorRoleCode: string, dto: CreateAdminDto) {
    return this.authService.createAdmin(creatorRoleCode, dto);
  }

  async updateAdmin(actorRoleCode: string, id: string, dto: UpdateAdminDto) {
    return this.authService.updateAdmin(actorRoleCode, id, dto);
  }

  async toggleAdminStatus(actorRoleCode: string, id: string) {
    return this.authService.toggleAdminStatus(actorRoleCode, id);
  }

  async deleteAdmin(actorRoleCode: string, id: string) {
    return this.authService.deleteAdmin(actorRoleCode, id);
  }

  async getAuditLogs() {
    const logs = await this.prisma.systemAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return logs.map((log) => ({
      id: log.id,
      event: log.event,
      details: log.details,
      createdAt: log.createdAt,
      time: formatRelativeTime(log.createdAt),
    }));
  }

  async getSettings() {
    let settings = await this.prisma.systemSetting.findFirst();
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          academicPeriod: 'Autumn Semester 2026',
          minAttendance: 75,
          editWindow: 24,
          allowFacultyOverride: true,
        },
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    let settings = await this.prisma.systemSetting.findFirst();
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          academicPeriod: dto.academicPeriod ?? 'Autumn Semester 2026',
          minAttendance: dto.minAttendance ?? 75,
          editWindow: dto.editWindow ?? 24,
          allowFacultyOverride: dto.allowFacultyOverride ?? true,
        },
      });
    } else {
      settings = await this.prisma.systemSetting.update({
        where: { id: settings.id },
        data: dto,
      });
    }

    await this.prisma.systemAuditLog.create({
      data: {
        event: 'System Configurations Modified',
        details: 'Global system configuration updated.',
      },
    });

    return settings;
  }
}
