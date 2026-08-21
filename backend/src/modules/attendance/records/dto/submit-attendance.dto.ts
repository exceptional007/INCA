import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceRecordItemDto } from './attendance-record-item.dto';

export class SubmitAttendanceDto {
  @ApiProperty({
    type: [AttendanceRecordItemDto],
    description: 'Array of student attendance records to submit.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records: AttendanceRecordItemDto[];
}
