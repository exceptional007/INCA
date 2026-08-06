import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { log } from 'console';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });
    return {
      success: true,
      message: 'User fetched successfully.',
      data: user,
    };
  }
}
