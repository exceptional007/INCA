import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { AuthRepository } from './repositories/auth.repository';
import {
  UnauthorizedException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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

  canManageRole(
    actorRoleCode: string,
    targetRoleCode: string,
  ): boolean {
    const permissions: Record<string, string[]> = {
      SUPER_ADMIN: ['ADMIN'],
      ADMIN: ['FACULTY', 'STUDENT', 'COORDINATOR'],
    };

    return permissions[actorRoleCode]?.includes(targetRoleCode) ?? false;
  }

  assertCanManageRole(
    actorRoleCode: string,
    targetRoleCode: string,
    action = 'manage',
  ): void {
    if (!this.canManageRole(actorRoleCode, targetRoleCode)) {
      throw new ForbiddenException(
        `${actorRoleCode} is not allowed to ${action} ${targetRoleCode} users.`,
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

    this.assertCanManageRole(creatorRoleCode, targetRole.code, 'create');

    const existingUser = await this.authRepository.findUserByEmail(dto.email);

    if (existingUser) {
      throw new ForbiddenException('A user with this email already exists.');
    }

    // If target role is ADMIN, department is required and validated
    if (targetRole.code === 'ADMIN') {
      if (!dto.departmentId) {
        throw new BadRequestException('departmentId is required for Admin accounts.');
      }
      const dept = await this.authRepository.findDepartmentById(dto.departmentId);
      if (!dept || !dept.isActive) {
        throw new BadRequestException('A valid, active department is required.');
      }
      const hashedPassword = await bcrypt.hash(dto.password, 12);
      const user = await this.authRepository.createAdminUser({
        email: dto.email,
        password: hashedPassword,
        roleId: dto.roleId,
        name: dto.name || dto.email.split('@')[0],
        departmentId: dto.departmentId,
      });

      await this.authRepository.createAuditLog({
        event: 'New Department Admin Created',
        details: `${dto.name || user.email} (${dept.name})`,
      });

      const { password, ...userWithoutPassword } = user;
      return {
        success: true,
        message: `${targetRole.name} user created successfully.`,
        data: userWithoutPassword,
      };
    }

    // Default creation flow for other roles (FACULTY, STUDENT, COORDINATOR)
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

  async getAdmins(actorRoleCode: string) {
    this.assertCanManageRole(actorRoleCode, 'ADMIN', 'view');
    const users = await this.authRepository.findAdmins();

    return users.map((user) => ({
      id: user.id,
      name: user.adminProfile?.name || user.email.split('@')[0],
      email: user.email,
      departmentId: user.adminProfile?.departmentId || '',
      departmentName: user.adminProfile?.department?.name || 'Unassigned',
      departmentCode: user.adminProfile?.department?.code || '',
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async createAdmin(
    creatorRoleCode: string,
    dto: { name: string; email: string; departmentId: string; password?: string },
  ) {
    this.assertCanManageRole(creatorRoleCode, 'ADMIN', 'create');

    if (!dto.departmentId) {
      throw new BadRequestException('departmentId is required for Admin creation.');
    }

    const dept = await this.authRepository.findDepartmentById(dto.departmentId);
    if (!dept || !dept.isActive) {
      throw new BadRequestException('A valid, active department is required.');
    }

    const existing = await this.authRepository.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const adminRole = await this.authRepository.findRoleByCode('ADMIN');
    if (!adminRole) {
      throw new NotFoundException('ADMIN role not found.');
    }

    const password = dto.password || 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.authRepository.createAdminUser({
      email: dto.email,
      password: hashedPassword,
      roleId: adminRole.id,
      name: dto.name,
      departmentId: dto.departmentId,
    });

    await this.authRepository.createAuditLog({
      event: 'New Department Admin Created',
      details: `${dto.name} (${dept.name})`,
    });

    return {
      id: user.id,
      name: user.adminProfile?.name,
      email: user.email,
      departmentId: user.adminProfile?.departmentId,
      departmentName: user.adminProfile?.department?.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async updateAdmin(
    actorRoleCode: string,
    id: string,
    dto: { name?: string; email?: string; departmentId?: string; isActive?: boolean },
  ) {
    const targetUser = await this.authRepository.findAdminById(id);
    if (!targetUser) {
      throw new NotFoundException('Admin account not found.');
    }

    // Strictly enforce that target user has role ADMIN
    if (targetUser.role.code !== 'ADMIN') {
      throw new ForbiddenException('You are only authorized to manage ADMIN users.');
    }

    this.assertCanManageRole(actorRoleCode, targetUser.role.code, 'edit');

    if (dto.email && dto.email !== targetUser.email) {
      const existing = await this.authRepository.findUserByEmail(dto.email);
      if (existing) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    let deptName = targetUser.adminProfile?.department?.name;
    if (dto.departmentId) {
      const dept = await this.authRepository.findDepartmentById(dto.departmentId);
      if (!dept || !dept.isActive) {
        throw new BadRequestException('Department must be a valid, active department.');
      }
      deptName = dept.name;
    }

    const userUpdateData: any = {};
    if (dto.email) userUpdateData.email = dto.email;
    if (dto.isActive !== undefined) userUpdateData.isActive = dto.isActive;

    if (Object.keys(userUpdateData).length > 0) {
      await this.authRepository.updateUser(id, userUpdateData);
    }

    const profileUpdateData: any = {};
    if (dto.name) profileUpdateData.name = dto.name;
    if (dto.departmentId) profileUpdateData.departmentId = dto.departmentId;

    if (Object.keys(profileUpdateData).length > 0) {
      await this.authRepository.updateAdminProfile(id, profileUpdateData);
    }

    const updatedUser = await this.authRepository.findAdminById(id);

    await this.authRepository.createAuditLog({
      event: 'Admin Account Updated',
      details: `${updatedUser?.adminProfile?.name || updatedUser?.email} (${updatedUser?.adminProfile?.department?.name || deptName || ''})`,
    });

    return {
      id: updatedUser?.id,
      name: updatedUser?.adminProfile?.name,
      email: updatedUser?.email,
      departmentId: updatedUser?.adminProfile?.departmentId,
      departmentName: updatedUser?.adminProfile?.department?.name,
      isActive: updatedUser?.isActive,
    };
  }

  async toggleAdminStatus(actorRoleCode: string, id: string) {
    const targetUser = await this.authRepository.findAdminById(id);
    if (!targetUser) {
      throw new NotFoundException('Admin account not found.');
    }

    if (targetUser.role.code !== 'ADMIN') {
      throw new ForbiddenException('You are only authorized to manage ADMIN users.');
    }

    this.assertCanManageRole(actorRoleCode, targetUser.role.code, 'edit');

    const newStatus = !targetUser.isActive;
    await this.authRepository.updateUser(id, { isActive: newStatus });

    const adminName = targetUser.adminProfile?.name || targetUser.email;
    const deptName = targetUser.adminProfile?.department?.name || '';

    await this.authRepository.createAuditLog({
      event: newStatus ? 'Admin Account Activated' : 'Admin Account Suspended',
      details: `${adminName} (${deptName})`,
    });

    return { id, isActive: newStatus };
  }

  async deleteAdmin(actorRoleCode: string, id: string) {
    const targetUser = await this.authRepository.findAdminById(id);
    if (!targetUser) {
      throw new NotFoundException('Admin account not found.');
    }

    if (targetUser.role.code !== 'ADMIN') {
      throw new ForbiddenException('You are only authorized to delete ADMIN users.');
    }

    this.assertCanManageRole(actorRoleCode, targetUser.role.code, 'delete');

    const adminName = targetUser.adminProfile?.name || targetUser.email;
    const deptName = targetUser.adminProfile?.department?.name || 'Department';

    await this.authRepository.deleteUser(id);

    await this.authRepository.createAuditLog({
      event: 'Admin Account Deleted',
      details: `${adminName} (${deptName})`,
    });

    return { id };
  }

  async getAllCoordinators() {
    const users = await this.authRepository.findCoordinators();
    
    // Map coordinators to CoordinatorRecord interface
    return users.map((user) => {
      const emailPrefix = user.email.split('@')[0];
      let name = emailPrefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      let program = 'Academic Program';

      if (emailPrefix === 'akumar') {
        name = 'Amit Kumar';
        program = 'B.Tech CS (3rd Yr)';
      } else if (emailPrefix === 'rbora') {
        name = 'Runima Bora';
        program = 'M.Tech CSE';
      }

      return {
        id: user.id,
        name,
        email: user.email,
        program,
        isActive: user.isActive,
      };
    });
  }

  async createCoordinator(dto: { email: string; password?: string }) {
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ForbiddenException('A user with this email already exists.');
    }

    const coordinatorRole = await this.authRepository.findRoleByCode('COORDINATOR');

    if (!coordinatorRole) {
      throw new NotFoundException('COORDINATOR role not found.');
    }

    const password = dto.password || 'Temp@12345';
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.authRepository.createUser({
      email: dto.email,
      password: hashedPassword,
      roleId: coordinatorRole.id,
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateCoordinator(id: string, dto: { email?: string; password?: string }) {
    const data: any = {};
    if (dto.email) data.email = dto.email;
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }
    
    const user = await this.authRepository.updateUser(id, data);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteCoordinator(id: string) {
    // We can either delete or deactivate. Let's do delete since the UI says "Record terminated"
    // and terminates it.
    return this.authRepository.deleteUser(id);
  }
}

