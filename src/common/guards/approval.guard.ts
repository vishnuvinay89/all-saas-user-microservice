import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserApprovalService } from '../../user-approval/user-approval.service';
import { PostgresRoleService } from '../../adapters/postgres/rbac/role-adapter';
import jwt_decode from 'jwt-decode';

@Injectable()
export class ApprovalGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userApprovalService: UserApprovalService,
    private postgresRoleService: PostgresRoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      const decoded: any = jwt_decode(request.headers.authorization);
      const userId = decoded.sub;

      // Check if user has super admin role using PostgresRoleService
      const isSuperAdmin = await this.postgresRoleService.isSuperAdmin(userId);
      
      if (isSuperAdmin) {
        return true; // Super admins can bypass approval checks
      }

      // For non-super admins, check if they have approved access
      const hasApprovedAccess = await this.userApprovalService.checkUserApprovalStatus(userId);
      
      if (!hasApprovedAccess) {
        throw new ForbiddenException(
          'You need approval from super admin to perform this action. Please submit an approval request first.'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Invalid token or insufficient permissions.');
    }
  }
}
