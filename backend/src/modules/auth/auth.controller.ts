import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import express from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from './dto/create-user.dto';
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
}
