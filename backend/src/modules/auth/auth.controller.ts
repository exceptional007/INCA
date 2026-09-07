import { Body, Controller, Post, Get, Patch, Delete, Param, Req, UseGuards } from '@nestjs/common';
import express from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Login to the system',
  })
  @ApiBody({
    type: LoginDto,
  })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      message: 'Current user fetched successfully.',
      data: user,
    };
  }

  @Post('users')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a user according to RBAC permissions',
  })
  async createUser(@Req() req: express.Request, @Body() dto: CreateUserDto) {
    const user = req.user as {
      id: string;
      email: string;
      role: string;
    };

    return this.authService.createUser(user.role, dto);
  }

  @Get('admins')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all admin accounts (SUPER_ADMIN only)',
  })
  async getAllAdmins(@Req() req: express.Request) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin accounts fetched successfully.',
      data: await this.authService.getAdmins(user.role),
    };
  }

  @Post('admins')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create an admin account with department (SUPER_ADMIN only)',
  })
  async createAdmin(@Req() req: express.Request, @Body() dto: CreateAdminDto) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin account created successfully.',
      data: await this.authService.createAdmin(user.role, dto),
    };
  }

  @Patch('admins/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update an admin account (SUPER_ADMIN only)',
  })
  async updateAdmin(
    @Req() req: express.Request,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin account updated successfully.',
      data: await this.authService.updateAdmin(user.role, id, dto),
    };
  }

  @Patch('admins/:id/toggle-status')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Toggle admin active/suspended status (SUPER_ADMIN only)',
  })
  async toggleAdminStatus(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { role: string };
    return {
      success: true,
      message: 'Admin status updated successfully.',
      data: await this.authService.toggleAdminStatus(user.role, id),
    };
  }

  @Delete('admins/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete an admin account (SUPER_ADMIN only)',
  })
  async deleteAdmin(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { role: string };
    await this.authService.deleteAdmin(user.role, id);
    return {
      success: true,
      message: 'Admin account deleted successfully.',
    };
  }

  @Get('coordinators')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all coordinators',
  })
  async getAllCoordinators() {
    return {
      success: true,
      message: 'Coordinators fetched successfully.',
      data: await this.authService.getAllCoordinators(),
    };
  }

  @Post('coordinators')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a coordinator user',
  })
  async createCoordinator(@Body() dto: { email: string; password?: string }) {
    return {
      success: true,
      message: 'Coordinator created successfully.',
      data: await this.authService.createCoordinator(dto),
    };
  }

  @Patch('coordinators/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update coordinator details',
  })
  async updateCoordinator(@Param('id') id: string, @Body() dto: any) {
    return {
      success: true,
      message: 'Coordinator updated successfully.',
      data: await this.authService.updateCoordinator(id, dto),
    };
  }

  @Delete('coordinators/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete a coordinator',
  })
  async deleteCoordinator(@Param('id') id: string) {
    await this.authService.deleteCoordinator(id);
    return {
      success: true,
      message: 'Coordinator deleted successfully.',
    };
  }
}
