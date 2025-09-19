import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../entities/user-approval-request.entity';

export class ApprovalRequestSearchDto {
  @ApiProperty({ description: 'Status to filter', enum: ApprovalStatus, required: false })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiProperty({ description: 'Page number for pagination', required: false })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Number of items per page', required: false })
  @IsOptional()
  limit?: number = 10;
}
