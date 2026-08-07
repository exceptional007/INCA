import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { AuthRepository } from './repositories/auth.repository';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {
    
    const user = await this.authRepository.findUserByEmail(loginDto.email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid email.');
    }
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password.');
    }

    const { password, ...userWithoutPassword } = user;

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
    }

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'User authenticated successfully.',
      data: {
        accessToken,
        user: userWithoutPassword,
      },
    };

  }
}
