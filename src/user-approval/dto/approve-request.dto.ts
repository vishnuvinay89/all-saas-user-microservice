import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../entities/user-approval-request.entity';

export class ApproveRequestDto {
  @ApiProperty({ description: 'Approval status', enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}
