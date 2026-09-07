import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { CreateAdminDto } from '../auth/dto/create-admin.dto';
import { UpdateAdminDto } from '../auth/dto/update-admin.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Super Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate system statistics for Super Admin dashboard' })
  async getStats() {
    return {
      success: true,
      message: 'System statistics fetched successfully.',
      data: await this.superAdminService.getStats(),
    };
  }

  @Get('admins')
  @ApiOperation({ summary: 'List all department admin accounts (SUPER_ADMIN only)' })
  async getAdmins(@Req() req: express.Request) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin accounts fetched successfully.',
      data: await this.superAdminService.getAdmins(user.role),
    };
  }

  @Post('admins')
  @ApiOperation({ summary: 'Create a department admin account (SUPER_ADMIN only)' })
  async createAdmin(@Req() req: express.Request, @Body() dto: CreateAdminDto) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin account created successfully.',
      data: await this.superAdminService.createAdmin(user.role, dto),
    };
  }

  @Patch('admins/:id')
  @ApiOperation({ summary: 'Update a department admin account details (SUPER_ADMIN only)' })
  async updateAdmin(
    @Req() req: express.Request,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin account updated successfully.',
      data: await this.superAdminService.updateAdmin(user.role, id, dto),
    };
  }

  @Patch('admins/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle department admin account active/suspended status (SUPER_ADMIN only)' })
  async toggleAdminStatus(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin account status updated successfully.',
      data: await this.superAdminService.toggleAdminStatus(user.role, id),
    };
  }

  @Delete('admins/:id')
  @ApiOperation({ summary: 'Delete a department admin account (SUPER_ADMIN only)' })
  async deleteAdmin(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { role: string };
    await this.superAdminService.deleteAdmin(user.role, id);
    return {
      success: true,
      message: 'Admin account deleted successfully.',
    };
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get recent system audit logs' })
  async getAuditLogs() {
    return {
      success: true,
      message: 'Audit logs fetched successfully.',
      data: await this.superAdminService.getAuditLogs(),
    };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get global system settings' })
  async getSettings() {
    return {
      success: true,
      message: 'System settings fetched successfully.',
      data: await this.superAdminService.getSettings(),
    };
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update global system settings' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return {
      success: true,
      message: 'System settings updated successfully.',
      data: await this.superAdminService.updateSettings(dto),
    };
  }
}
