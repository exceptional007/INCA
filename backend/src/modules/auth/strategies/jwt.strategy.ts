import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../repositories/auth.repository';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly db: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    if (typeof payload?.sub !== 'string' || !payload.sub)
      throw new UnauthorizedException('Invalid session.');
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user?.isActive || !user.role?.isActive)
      throw new UnauthorizedException(
        'Account is inactive or no longer available.',
      );
    if (
      typeof payload.sid !== 'string' ||
      !['access', 'password-change'].includes(payload.purpose)
    )
      throw new UnauthorizedException('Sign in again to upgrade your session.');
    const session = await this.db.authSession.findUnique({
      where: { id: payload.sid },
    });
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.authVersion !== user.authVersion
    )
      throw new UnauthorizedException('Session revoked or expired.');
    const restricted =
      user.mustChangePassword || payload.purpose === 'password-change';
    if (
      restricted &&
      ![
        '/api/v1/auth/me',
        '/api/v1/auth/change-password',
        '/api/v1/auth/logout-all',
      ].includes(req.originalUrl?.split('?')[0])
    )
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    return {
      id: user.id,
      email: user.email,
      role: user.role.code,
      sessionId: session.id,
      mustChangePassword: !!restricted,
    };
  }
}
