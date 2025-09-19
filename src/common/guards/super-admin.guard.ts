import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PostgresRoleService } from '../../adapters/postgres/rbac/role-adapter';
import jwt_decode from 'jwt-decode';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private postgresRoleService: PostgresRoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      const decoded: any = jwt_decode(request.headers.authorization);
      const userId = decoded.sub;
      
      // Check if user has super admin role using PostgresRoleService
      const isSuperAdmin = await this.postgresRoleService.isSuperAdmin(userId);
      
      if (!isSuperAdmin) {
        throw new ForbiddenException('Access denied. Super admin role required.');
      }

      return true;
    } catch (error) {
      throw new ForbiddenException('Invalid token or insufficient permissions.');
    }
  }
}
