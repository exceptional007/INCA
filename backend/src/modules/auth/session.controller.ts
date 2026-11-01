import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  Header,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SessionService } from './session.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-lifecycle.dto';

export const refreshCookie = 'inca_refresh';
export function readRefresh(req: Request) {
  return (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(refreshCookie + '='))
    ?.slice(refreshCookie.length + 1);
}
export function setRefresh(
  res: Response,
  config: ConfigService,
  token?: string,
) {
  const secure = config.get('NODE_ENV') === 'production';
  const sameSite =
    config.get('AUTH_COOKIE_SAME_SITE') === 'none' && secure ? 'none' : 'lax';
  const options = {
    httpOnly: true,
    secure,
    sameSite: sameSite as 'none' | 'lax',
    path: '/api/v1/auth',
  };
  if (token)
    res.cookie(refreshCookie, token, { ...options, maxAge: 7 * 86400000 });
  else res.clearCookie(refreshCookie, options);
  res.setHeader('Cache-Control', 'no-store');
}
export function assertOrigin(req: Request, config: ConfigService) {
  if (req.headers.origin && req.headers.origin !== config.get('FRONTEND_URL'))
    throw new ForbiddenException('Untrusted request origin.');
  if (req.headers['sec-fetch-site'] === 'cross-site' && !req.headers.origin)
    throw new ForbiddenException('Request origin required.');
}
@Controller({ path: 'auth', version: '1' })
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(req, this.config);
    await this.sessions.throttle('refresh', req.ip || 'unknown', 100);
    try {
      const { refreshToken, ...data } = await this.sessions.refresh(
        readRefresh(req) || '',
      );
      setRefresh(res, this.config, refreshToken);
      return { success: true, data };
    } catch (error) {
      setRefresh(res, this.config);
      throw error;
    }
  }
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertOrigin(req, this.config);
    await this.sessions.logout(readRefresh(req));
    setRefresh(res, this.config);
    return { success: true };
  }
  @Post('forgot-password')
  async forgot(@Req() req: Request, @Body() dto: ForgotPasswordDto) {
    await this.sessions.throttle('forgot-ip', req.ip || 'unknown', 20);
    await this.sessions.throttle('forgot-email', dto.email, 3);
    return this.sessions.forgot(dto.email);
  }
  @Post('reset-password')
  async reset(
    @Req() req: Request,
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.throttle('reset', req.ip || 'unknown', 15);
    const result = await this.sessions.reset(dto.token, dto.newPassword);
    setRefresh(res, this.config);
    return result;
  }
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async change(
    @Req() req: any,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.throttle('change', req.user.id, 10);
    const result = await this.sessions.change(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    setRefresh(res, this.config);
    return result;
  }
  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.sessions.revokeAll(req.user.id);
    setRefresh(res, this.config);
    return result;
  }
  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  @Header('Cache-Control', 'no-store')
  sessionsList(@Req() req: any) {
    return this.sessions.sessions(req.user.id, req.user.sessionId);
  }
  @UseGuards(AuthGuard('jwt'))
  @Delete('sessions/:id')
  revoke(@Req() req: any, @Param('id') id: string) {
    return this.sessions.revoke(req.user.id, id);
  }
}
