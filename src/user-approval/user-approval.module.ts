import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApprovalController } from './user-approval.controller';
import { UserApprovalService } from './user-approval.service';
import { UserApprovalRequest } from './entities/user-approval-request.entity';
import { User } from '../user/entities/user-entity';
import { PostgresRoleService } from '../adapters/postgres/rbac/role-adapter';
import { Role } from '../rbac/role/entities/role.entity';
import { UserRoleMapping } from '../rbac/assign-role/entities/assign-role.entity';
import { RolePrivilegeMapping } from '../rbac/assign-privilege/entities/assign-privilege.entity';
import { MailService } from 'src/common/mail.service';
import { TenantModule } from 'src/tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserApprovalRequest, 
      User, 
      Role, 
      UserRoleMapping, 
      RolePrivilegeMapping
    ]),
    forwardRef(() => TenantModule)
  ],
  controllers: [UserApprovalController],
  providers: [UserApprovalService, PostgresRoleService, MailService],
  exports: [UserApprovalService],
})
export class UserApprovalModule {}
