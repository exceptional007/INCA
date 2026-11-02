import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthRepository } from './repositories/auth.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { jwtConstants } from './constants/auth.constants';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionService } from './session.service';
import { PasswordMailService } from './password-mail.service';
import { SessionController } from './session.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: jwtConstants.accessTokenExpiry,
        },
      }),
    }),
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, AuthRepository,JwtStrategy, SessionService, PasswordMailService],
  exports: [JwtModule, AuthService, JwtStrategy],
})
export class AuthModule {}
