import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserApprovalRequest, ApprovalStatus } from './entities/user-approval-request.entity';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { ApprovalRequestSearchDto } from './dto/approval-request-search.dto';
import { User } from '../user/entities/user-entity';
import { UserRoleMapping } from '../rbac/assign-role/entities/assign-role.entity';
import { Role } from '../rbac/role/entities/role.entity';
import { PostgresRoleService } from '../adapters/postgres/rbac/role-adapter';
import { MailService } from '../common/mail.service'
import {TenantService} from '../tenant/tenant.service'
import jwt_decode from 'jwt-decode';

@Injectable()
export class UserApprovalService {
  constructor(
    @InjectRepository(UserApprovalRequest)
    private approvalRequestRepository: Repository<UserApprovalRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRoleMapping)
    private userRoleMappingRepository: Repository<any>,
    @InjectRepository(Role)
    private roleRepository: Repository<any>,
    private postgresRoleService: PostgresRoleService,
    @Inject(forwardRef(() => TenantService))
    private tenantService: TenantService,
    private mailService: MailService,
  ) {}


    async getAllSuperAdmins() {
      const superAdminRole = await this.roleRepository.findOne({
        where: { code: 'super_admin' },
      });
      if (!superAdminRole) return [];
      const userRoles = await this.userRoleMappingRepository.find({
        where: { roleId: superAdminRole.roleId },
      });
      const userIds = userRoles.map((ur) => ur.userId);
      const users = await this.userRepository.find({
        where: { userId: In(userIds) },
      });    
      return users;
    }

  async createApprovalRequest(request: any): Promise<UserApprovalRequest> {
    const decoded: any = jwt_decode(request.headers.authorization);
    const userId = decoded.sub;
    const email = decoded.email;
    const name = decoded.name
    const tenantName = request.body.name;
    const domain = request.body.domain || "";

    
    // check if there is any pending request for the same tenant name
    const existingRequest = await this.approvalRequestRepository.findOne({
      where: {
        tenantName,
        status: ApprovalStatus.PENDING,
      },
    });
    if (existingRequest) {
      throw new BadRequestException(
        'There is already a pending request with the same tenant name',
      );
    }

    const approvalRequest = this.approvalRequestRepository.create({
      userId,
      tenantName,
      domain
    });

    const savedRequest = await this.approvalRequestRepository.save(approvalRequest);

    try {
    // Find all super admins
    // const superAdmins = await this.getAllSuperAdmins();
    let superAdmins = [{email: process.env.SUPER_ADMIN_EMAIL}];

    // Construct approval URL (adjust base URL as needed)
    const approvalUrl = process.env.APPROVAL_URL;

    // Send email to each super admin in parallel
    await Promise.all(superAdmins.map((admin: any) =>
      this.mailService.sendMail({
        to: admin.email,
        subject: `New Tenant Creation Request - ${tenantName}`,
        html: `
              <p>A new tenant creation request has been submitted.</p>
              <p>Tenant Name :  <b>${tenantName}</b>
              <p>Submitted by :  <b>${name}</b>
              <p>Submitted on :  <b>${new Date().toLocaleString()}</b>
              <p>Please log in to the Admin Portal to approve or reject this request.<a href="${approvalUrl}"><b>Click Here</b></a></p>`,
      })
    ));
    } catch (error) {
      await this.approvalRequestRepository.delete(savedRequest.approvalId);
      throw new Error(`Mail sending failed: ${error.message}`);
    }

    return approvalRequest;
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
    let approved = await this.approvalRequestRepository.save(approvalRequest)

    if (approved) {
      const user = await this.userRepository.findOne({ where: { userId: approved.userId } });

      const messages = {
        [ApprovalStatus.APPROVED]: {
          subject: `Tenant Request Approved – ${approved.tenantName}`,
          html: `
            <p>Dear User,</p>
            <p>We are pleased to inform you that your tenant creation request for 
            <strong>${approved.tenantName}</strong> has been approved and successfully created.</p>
            <p>You can now begin configuring and managing your tenant.</p>
            <p>Please log in to the Admin Portal to view the tenant. <a href="${process.env.TENANT_REDIRECT_URL}"><b>Click Here</b></a></p>
            <p>Best regards,<br/>Admin</p>
          `,
          action: async () => {
            request.userId = approved.userId;
            await this.tenantService.createtenantandAssignRoles(request, {
              name: approved.tenantName,
              domain: approved.domain || "",
            });
          },
        },
        [ApprovalStatus.REJECTED]: {
          subject: `Tenant Request Rejected – ${approved.tenantName}`,
          html: `
            <p>Dear User,</p>
            <p>We regret to inform you that your tenant creation request for 
            <strong>${approved.tenantName}</strong> has been rejected.</p>
            <p>If you require further clarification, please contact the system administrator at 
            <a href="mailto:${process.env.SUPER_ADMIN_EMAIL}">${process.env.SUPER_ADMIN_EMAIL}</a>.</p>
            <p>Thank you for your understanding.</p>
            <p>Best regards,<br/>Admin</p>
          `,
        },
      };

    
      const msg = messages[approved.status];
      if (msg) {
        if (msg.action) await msg.action();
          await this.mailService.sendMail({ to: user.email, subject: msg.subject, html: msg.html });
      }
    }
    return approved;
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
