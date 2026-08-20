import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { AuthRepository } from './repositories/auth.repository';
import {
  UnauthorizedException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

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
    };

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

  private canCreateRole(
    creatorRoleCode: string,
    targetRoleCode: string,
  ): boolean {
    const permissions: Record<string, string[]> = {
      SUPER_ADMIN: ['ADMIN'],
      ADMIN: ['FACULTY', 'STUDENT', 'COORDINATOR'],
    };

    return permissions[creatorRoleCode]?.includes(targetRoleCode) ?? false;
  }

  private assertCanCreateRole(
    creatorRoleCode: string,
    targetRoleCode: string,
  ): void {
    if (!this.canCreateRole(creatorRoleCode, targetRoleCode)) {
      throw new ForbiddenException(
        `${creatorRoleCode} is not allowed to create ${targetRoleCode} users.`,
      );
    }
  }
  async createUser(
    creatorRoleCode: string,
    dto: CreateUserDto,
  ): Promise<ApiResponse<any>> {
    const targetRole = await this.authRepository.findRoleById(dto.roleId);

    if (!targetRole) {
      throw new UnauthorizedException('Target role not found.');
    }

    this.assertCanCreateRole(creatorRoleCode, targetRole.code);

    const existingUser = await this.authRepository.findUserByEmail(dto.email);

    if (existingUser) {
      throw new ForbiddenException('A user with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.authRepository.createUser({
      email: dto.email,
      password: hashedPassword,
      roleId: dto.roleId,
    });

    const { password, ...userWithoutPassword } = user;

    return {
      success: true,
      message: `${targetRole.name} user created successfully.`,
      data: userWithoutPassword,
    };
  }
}
