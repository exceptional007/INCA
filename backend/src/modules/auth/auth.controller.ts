import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Req,
  Res,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { setRefresh, assertOrigin } from './session.controller';
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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCoordinatorDto } from './dto/create-coordinator.dto';
import { UpdateCoordinatorDto } from './dto/update-coordinator.dto';

@ApiTags('Authentication')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Login to the system',
  })
  @ApiBody({
    type: LoginDto,
  })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    assertOrigin(req, this.config);
    await this.sessions.throttle('login-ip', req.ip || 'unknown', 50);
    await this.sessions.throttle('login-email', loginDto.email, 15);
    const result = await this.authService.login(loginDto);
    const { refreshToken, ...data } = result.data;
    setRefresh(res, this.config, refreshToken);
    return { ...result, data };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Header('Cache-Control', 'no-store')
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
  async toggleAdminStatus(
    @Req() req: express.Request,
    @Param('id') id: string,
  ) {
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get all coordinators (ADMIN only)',
  })
  async getAllCoordinators(@CurrentUser() user: { role: string }) {
    return {
      success: true,
      message: 'Coordinators fetched successfully.',
      data: await this.authService.getAllCoordinators(user.role),
    };
  }

  @Post('coordinators')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Create a coordinator user (ADMIN only)',
  })
  async createCoordinator(
    @CurrentUser() user: { role: string },
    @Body() dto: CreateCoordinatorDto,
  ) {
    return {
      success: true,
      message: 'Coordinator created successfully.',
      data: await this.authService.createCoordinator(user.role, dto),
    };
  }

  @Patch('coordinators/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update coordinator details (ADMIN only)',
  })
  async updateCoordinator(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
    @Body() dto: UpdateCoordinatorDto,
  ) {
    return {
      success: true,
      message: 'Coordinator updated successfully.',
      data: await this.authService.updateCoordinator(user.role, id, dto),
    };
  }

  @Delete('coordinators/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Delete a coordinator (ADMIN only)',
  })
  async deleteCoordinator(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    await this.authService.deleteCoordinator(user.role, id);
    return {
      success: true,
      message: 'Coordinator deleted successfully.',
    };
  }
}
