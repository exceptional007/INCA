import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ExceptionRepository } from './repositories/exception.repository';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';

export interface ScheduleExceptionActor {
  id: string;
  role: string;
}

@Injectable()
export class ExceptionsService {
  constructor(private readonly exceptionRepository: ExceptionRepository) {}

  private async adminDepartment(
    actor: ScheduleExceptionActor,
  ): Promise<string> {
    if (!actor?.id || actor.role !== 'ADMIN')
      throw new ForbiddenException(
        'Only ADMIN accounts can modify schedule exceptions.',
      );
    const departmentId = await this.exceptionRepository.getAdminDepartmentId(
      actor.id,
    );
    if (!departmentId)
      throw new ForbiddenException('An assigned department is required.');
    return departmentId;
  }
  private async assertScheduleDepartment(
    scheduleId: string,
    departmentId: string,
  ) {
    const actual =
      await this.exceptionRepository.getScheduleDepartmentId(scheduleId);
    if (!actual) throw new NotFoundException('Schedule not found.');
    if (actual !== departmentId)
      throw new ForbiddenException(
        'You can only modify schedule exceptions within your assigned department.',
      );
  }
  async create(
    createExceptionDto: CreateExceptionDto,
    actor: ScheduleExceptionActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    await this.assertScheduleDepartment(
      createExceptionDto.scheduleId,
      departmentId,
    );
    const exception = await this.exceptionRepository.create(createExceptionDto);

    return {
      success: true,
      message: 'Schedule exception created successfully.',
      data: exception,
    };
  }

  async findAll(): Promise<ApiResponse<any>> {
    const exceptions = await this.exceptionRepository.findAll();
    return {
      success: true,
      message: 'Schedule exceptions retrieved successfully.',
      data: exceptions,
    };
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const exception = await this.exceptionRepository.findById(id);
    if (!exception) {
      throw new NotFoundException(
        `Schedule exception with ID ${id} not found.`,
      );
    }
    return {
      success: true,
      message: 'Schedule exception retrieved successfully.',
      data: exception,
    };
  }

  async update(
    id: string,
    updateExceptionDto: UpdateExceptionDto,
    actor: ScheduleExceptionActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    const exception = await this.exceptionRepository.findById(id);
    if (!exception) {
      throw new NotFoundException(
        `Schedule exception with ID ${id} not found.`,
      );
    }

    await this.assertScheduleDepartment(exception.scheduleId, departmentId);
    if (
      updateExceptionDto.scheduleId &&
      updateExceptionDto.scheduleId !== exception.scheduleId
    )
      await this.assertScheduleDepartment(
        updateExceptionDto.scheduleId,
        departmentId,
      );
    const updated = await this.exceptionRepository.update(
      id,
      updateExceptionDto,
      exception.scheduleId,
    );
    return {
      success: true,
      message: 'Schedule exception updated successfully.',
      data: updated,
    };
  }

  async remove(
    id: string,
    actor: ScheduleExceptionActor,
  ): Promise<ApiResponse<any>> {
    const departmentId = await this.adminDepartment(actor);
    const exception = await this.exceptionRepository.findById(id);
    if (!exception) {
      throw new NotFoundException(
        `Schedule exception with ID ${id} not found.`,
      );
    }

    await this.assertScheduleDepartment(exception.scheduleId, departmentId);
    await this.exceptionRepository.remove(id, exception.scheduleId);
    return {
      success: true,
      message: 'Schedule exception deleted successfully.',
      data: null,
    };
  }
}
