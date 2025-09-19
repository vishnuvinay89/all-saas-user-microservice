import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApprovalRequest, ApprovalStatus } from './entities/user-approval-request.entity';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { ApprovalRequestSearchDto } from './dto/approval-request-search.dto';
import { User } from '../user/entities/user-entity';
import { PostgresRoleService } from '../adapters/postgres/rbac/role-adapter';
import jwt_decode from 'jwt-decode';

@Injectable()
export class UserApprovalService {
  constructor(
    @InjectRepository(UserApprovalRequest)
    private approvalRequestRepository: Repository<UserApprovalRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private postgresRoleService: PostgresRoleService,
  ) {}

  // User method - for regular users to request approval
  async createApprovalRequest(request: any): Promise<UserApprovalRequest> {
    const decoded: any = jwt_decode(request.headers.authorization);
    const userId = decoded.sub;

    // Check if user already has a pending request
    const existingRequest = await this.approvalRequestRepository.findOne({
      where: {
        userId,
        status: ApprovalStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'You already have a pending approval request',
      );
    }

    // Check if user already has an approved request
    const approvedRequest = await this.approvalRequestRepository.findOne({
      where: {
        userId,
        status: ApprovalStatus.APPROVED,
      },
    });

    if (approvedRequest) {
      throw new BadRequestException(
        'You already have approved access',
      );
    }

    const approvalRequest = this.approvalRequestRepository.create({
      userId,
    });

    return await this.approvalRequestRepository.save(approvalRequest);
  }

  // Unified method - for both users and super admins
  async getApprovalRequests(
    request: any,
    searchDto: ApprovalRequestSearchDto,
  ): Promise<{ data: UserApprovalRequest[]; total: number }> {
    const decoded: any = jwt_decode(request.headers.authorization);
    const userId = decoded.sub;
    
    // Check if user is super admin using PostgresRoleService
    const isSuperAdmin = await this.postgresRoleService.isSuperAdmin(userId);

    const queryBuilder = this.approvalRequestRepository
      .createQueryBuilder('request')
      .leftJoin('request.user', 'user')
      .select([
        'request',
        'user.username',
        'user.name',
        'user.email',
      ]);

    // If not super admin, only show user's own requests
    if (!isSuperAdmin) {
      queryBuilder.andWhere('request.userId = :userId', { userId });
    }

    // Apply status filter if provided
    if (searchDto.status) {
      queryBuilder.andWhere('request.status = :status', {
        status: searchDto.status,
      });
    }

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('request.createdAt', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  // Unified method for updating approval status (super admin only)
  async updateApprovalRequest(
    approvalId: string,
    approveDto: ApproveRequestDto,
    request: any,
  ): Promise<UserApprovalRequest> {
    const decoded: any = jwt_decode(request.headers.authorization);
    const userId = decoded.sub;
    
    // Only super admins can update approval requests using PostgresRoleService
    const isSuperAdmin = await this.postgresRoleService.isSuperAdmin(userId);
    
    if (!isSuperAdmin) {
      throw new BadRequestException('Only super admins can update approval requests');
    }

    const approvalRequest = await this.approvalRequestRepository.findOne({
      where: { approvalId },
      relations: ['user'],
    });

    if (!approvalRequest) {
      throw new NotFoundException('Approval request not found');
    }

    if (approvalRequest.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    approvalRequest.status = approveDto.status;

    return await this.approvalRequestRepository.save(approvalRequest);
  }

  // Utility method for checking approval status (used by guards)
  async checkUserApprovalStatus(userId: string): Promise<boolean> {
    const approvedRequest = await this.approvalRequestRepository.findOne({
      where: {
        userId,
        status: ApprovalStatus.APPROVED,
      },
    });

    return !!approvedRequest;
  }
}
