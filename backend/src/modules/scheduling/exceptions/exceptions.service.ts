import { Injectable, NotFoundException } from '@nestjs/common';
import { ExceptionRepository } from './repositories/exception.repository';
import { ScheduleRepository } from '../schedules/repositories/schedule.repository';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly exceptionRepository: ExceptionRepository,
    private readonly scheduleRepository: ScheduleRepository,
  ) {}

  async create(createExceptionDto: CreateExceptionDto): Promise<ApiResponse<any>> {
    const schedule = await this.scheduleRepository.findById(createExceptionDto.scheduleId);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${createExceptionDto.scheduleId} not found.`);
    }

    const exception = await this.exceptionRepository.create(createExceptionDto);

    if (createExceptionDto.exceptionType === 'CANCELLATION') {
      await this.scheduleRepository.update(schedule.id, { status: ScheduleStatus.CANCELLED });
    } else if (createExceptionDto.exceptionType === 'RESCHEDULE' || createExceptionDto.newStartTime || createExceptionDto.newEndTime || createExceptionDto.newRoomId || createExceptionDto.newFacultyId) {
      await this.scheduleRepository.update(schedule.id, { status: ScheduleStatus.RESCHEDULED });
    }

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
      throw new NotFoundException(`Schedule exception with ID ${id} not found.`);
    }
    return {
      success: true,
      message: 'Schedule exception retrieved successfully.',
      data: exception,
    };
  }

  async update(id: string, updateExceptionDto: UpdateExceptionDto): Promise<ApiResponse<any>> {
    const exception = await this.exceptionRepository.findById(id);
    if (!exception) {
      throw new NotFoundException(`Schedule exception with ID ${id} not found.`);
    }

    const updated = await this.exceptionRepository.update(id, updateExceptionDto);
    return {
      success: true,
      message: 'Schedule exception updated successfully.',
      data: updated,
    };
  }

  async remove(id: string): Promise<ApiResponse<any>> {
    const exception = await this.exceptionRepository.findById(id);
    if (!exception) {
      throw new NotFoundException(`Schedule exception with ID ${id} not found.`);
    }

    await this.exceptionRepository.remove(id);
    return {
      success: true,
      message: 'Schedule exception deleted successfully.',
      data: null,
    };
  }
}
