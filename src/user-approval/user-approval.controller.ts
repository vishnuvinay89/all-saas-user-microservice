import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserApprovalService } from './user-approval.service';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { ApprovalRequestSearchDto } from './dto/approval-request-search.dto';
import { JwtAuthGuard } from '../common/guards/keycloak.guard';
import { AllExceptionsFilter } from '../common/filters/exception.filter';
import APIResponse from '../common/responses/response';
import { APIID } from '../common/utils/api-id.config';
import { HttpStatus } from '@nestjs/common';

@ApiTags('User Approval')
@Controller('user-approval')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class UserApprovalController {
  constructor(private readonly userApprovalService: UserApprovalService) {}

  // User endpoint - Create approval request
  @Post('create')
  @UseFilters(new AllExceptionsFilter(APIID.APPROVAL_REQUEST_CREATE))
  @ApiOperation({ summary: 'Create a new approval request' })
  @ApiResponse({ status: 201, description: 'Approval request created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createApprovalRequest(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.userApprovalService.createApprovalRequest(request);

      return APIResponse.success(
        response,
        APIID.APPROVAL_REQUEST_CREATE,
        result,
        HttpStatus.CREATED,
        'Approval request created successfully',
      );
    } catch (error) {
      return APIResponse.error(
        response,
        APIID.APPROVAL_REQUEST_CREATE,
        'BAD_REQUEST',
        error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Unified endpoint - Get requests (all for super admin, own for regular users)
  @Get('read')
  @UseFilters(new AllExceptionsFilter(APIID.APPROVAL_REQUEST_LIST))
  @ApiOperation({ 
    summary: 'Get approval requests - all requests for super admin, own requests for regular users' 
  })
  @ApiResponse({ status: 200, description: 'Approval requests retrieved successfully' })
  async getApprovalRequests(
    @Req() request: Request,
    @Res() response: Response,
    @Query() searchDto: ApprovalRequestSearchDto,
  ) {
    try {
      const result = await this.userApprovalService.getApprovalRequests(request,searchDto);

      return APIResponse.success(
        response,
        APIID.APPROVAL_REQUEST_LIST,
        result,
        HttpStatus.OK,
        'Approval requests retrieved successfully',
      );
    } catch (error) {
      return APIResponse.error(
        response,
        APIID.APPROVAL_REQUEST_LIST,
        'INTERNAL_SERVER_ERROR',
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Unified endpoint - Update approval status (super admin only)
  @Put('update/:approvalId')
  @UseFilters(new AllExceptionsFilter(APIID.APPROVAL_REQUEST_APPROVE))
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Update approval request status (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Request updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async updateApprovalRequest(
    @Req() request: Request,
    @Res() response: Response,
    @Param('approvalId') approvalId: string,
    @Body() approveDto: ApproveRequestDto,
  ) {
    try {
      const result = await this.userApprovalService.updateApprovalRequest(
        approvalId,
        approveDto,
        request,
      );

      return APIResponse.success(
        response,
        APIID.APPROVAL_REQUEST_APPROVE,
        result,
        HttpStatus.OK,
        'Request updated successfully',
      );
    } catch (error) {
      const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
      return APIResponse.error(
        response,
        APIID.APPROVAL_REQUEST_APPROVE,
        error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        error.message,
        statusCode,
      );
    }
  }
}
