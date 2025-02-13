import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import jwt_decode from "jwt-decode";
import APIResponse from "src/common/responses/response";
import { PostgresAssignPrivilegeService } from 'src/adapters/postgres/rbac/privilegerole.adapter';
import { PostgresRoleService } from 'src/adapters/postgres/rbac/role-adapter';
import { PostgresUserService } from 'src/adapters/postgres/user-adapter';
import { Cohort } from 'src/cohort/entities/cohort.entity';
import { UserRoleMapping } from 'src/rbac/assign-role/entities/assign-role.entity';
import { User } from 'src/user/entities/user-entity';
import { Tenants } from 'src/userTenantMapping/entities/tenant.entity';
import { UserTenantMapping } from 'src/userTenantMapping/entities/user-tenant-mapping.entity';
import { Not, Repository } from 'typeorm';
import { API_RESPONSES } from '@utils/response.messages';
import { Invitations } from './entities/invitation.entity';
import { CohortMembers } from 'src/cohortMembers/entities/cohort-member.entity';
import { APIID } from '@utils/api-id.config';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { Role } from 'src/rbac/role/entities/role.entity';
@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(UserTenantMapping)
    private UserTenantMappingRepository: Repository<UserTenantMapping>,
    @InjectRepository(Invitations)
    public invitationsRepository: Repository<Invitations>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CohortMembers)
    private cohortMembersRepository: Repository<CohortMembers>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(UserRoleMapping)
    private userRoleMappingRepository: Repository<UserRoleMapping>,
    private readonly userService: PostgresUserService,
    private roleService: PostgresRoleService,
    private rolePrivilegeService: PostgresAssignPrivilegeService,
    private postgresUserService: PostgresUserService
  ) { }
  public async sendInvite(request, createInvitationDto, response) {
    const apiId = APIID.SEND_INVITATION
    try {
      const decoded = jwt_decode(request.headers["authorization"]);
      createInvitationDto.invitedBy = decoded["email"];

      // Check if the tenant-cohort mapping exists
      const tenantCohortExist = await this.cohortRepository.findOne({
        where: {
          tenantId: createInvitationDto.tenantId,
          cohortId: createInvitationDto.cohortId,
        },
      });

      if (!tenantCohortExist) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          "Tenant and cohort mapping not found",
          HttpStatus.CONFLICT
        );
      }
      // check if duplicate request exist with status pending
      const checkInvitaionExist = await this.invitationsRepository.findOne({
        where: {
          tenantId: createInvitationDto.tenantId,
          cohortId: createInvitationDto.cohortId,
          invitedTo: createInvitationDto.invitedTo,
          invitationStatus: "Pending"
        },
      })
      if (checkInvitaionExist) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          "Invitation already sent",
          HttpStatus.CONFLICT
        );
      }

      // Check if the user exists
      const checkUser = await this.usersRepository.findOne({
        where: { email: createInvitationDto.invitedTo },
      });

      if (!checkUser) {
        const result = await this.invitationsRepository.save(
          createInvitationDto
        );
        return APIResponse.success(
          response,
          apiId,
          result,
          HttpStatus.OK,
          API_RESPONSES.INVITATION_SUCCESS
        );
      }

      // Fetch user roles
      const userRoles = await this.userService.getUserRoles(checkUser.userId, createInvitationDto.tenantId);

      if (!userRoles) {
        const result = await this.invitationsRepository.save(
          createInvitationDto
        );
        return APIResponse.success(
          response,
          apiId,
          result,
          HttpStatus.OK,
          API_RESPONSES.INVITATION_SUCCESS
        );
      }

      // Handle different user roles
      if (userRoles.code === "tenant_admin") {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          API_RESPONSES.INVITEDUSER_CONFLICT('tenant admin'),
          HttpStatus.CONFLICT
        );
      }

      if (userRoles.code === "cohort_admin") {
        // Check if the user is already mapped to the cohort
        const cohortExists = await this.cohortMembersRepository.findOne({
          where: {
            userId: checkUser.userId,
            cohortId: createInvitationDto.cohortId,
          },
        });

        if (cohortExists) {
          return APIResponse.error(
            response,
            apiId,
            API_RESPONSES.CONFLICT,
            API_RESPONSES.INVITEDUSER_CONFLICT('cohort admin'),
            HttpStatus.CONFLICT
          );
        }
      }

      // Save invitation if no conflicts
      const result = await this.invitationsRepository.save(createInvitationDto);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.INVITATION_SUCCESS
      );
    } catch (error) {
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        error,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async getInvitations(request, response) {
    const authToken = request.headers["authorization"];
    const token = authToken.split(" ")[1];
    const decoded = jwt_decode(token);
    const email = decoded["email"];
    const apiId = APIID.INVITATION_GET;

    try {
      let receivedInvitations = [];
      receivedInvitations = await this.invitationsRepository.find({
        where: { invitedTo: email, invitationStatus: "Pending" },
      });

      let sentInvitations = [];
      sentInvitations = await this.invitationsRepository.find({
        where: { invitedBy: email, invitationStatus: Not("Revoked") },
      });

      // Add cohort name response
      receivedInvitations = await Promise.all(
        receivedInvitations.map(async (invitation) => {
          const cohort = await this.cohortRepository.findOne({
            where: { cohortId: invitation.cohortId },
          });

          return {
            invitationId: invitation.invitationId,
            tenantId: invitation.tenantId,
            cohortId: invitation.cohortId,
            cohortName: cohort.name,
            invitedBy: invitation.invitedBy,
            invitationStatus: invitation.invitationStatus,
            sentAt: invitation.sentAt,
          };
        })
      );

      // Add cohort name response
      sentInvitations = await Promise.all(
        sentInvitations.map(async (invitation) => {
          const cohort = await this.cohortRepository.findOne({
            where: { cohortId: invitation.cohortId },
          });

          return {
            invitationId: invitation.invitationId,
            tenantId: invitation.tenantId,
            cohortId: invitation.cohortId,
            cohortName: cohort.name,
            invitedTo: invitation.invitedTo,
            invitationStatus: invitation.invitationStatus,
            sentAt: invitation.sentAt,
          };
        })
      );

      const result = { receivedInvitations, sentInvitations };

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.INVITATIONS_FETCHED
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updateInvitation(
    request,
    response,
    invitationId: string,
    updateInvitationDto: UpdateInvitationDto
  ) {
    const apiId = APIID.INVITATION_UPDATE;
    const authToken = request.headers["authorization"];
    const token = authToken.split(" ")[1];
    const decoded = jwt_decode(token);
    const email = decoded["email"];
    const userId = decoded["sub"];

    try {
      const invitation = await this.invitationsRepository.findOne({
        where: { invitationId: invitationId },
      });

      if (!invitation) {
        const error = API_RESPONSES.INVITATION_NOTFOUND;
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.INVITATION_NOTFOUND,
          error,
          HttpStatus.CONFLICT
        );
      }

      if (updateInvitationDto.invitationStatus !== 'Revoked') {
        // Only invitee can accept or reject (update status)
        if (invitation.invitedTo !== email) {
          const error = API_RESPONSES.INVITEE_ONLY;
          return APIResponse.error(
            response,
            apiId,
            API_RESPONSES.INVITEE_ONLY,
            error,
            HttpStatus.UNAUTHORIZED
          );
        }

        // If accepted, then map user as cohort admin
        if (updateInvitationDto.invitationStatus === "Accepted") {
          // Get role for roleId
          const role = await this.roleRepository.findOne({
            where: { tenantId: invitation.tenantId, code: "cohort_admin" },
          });

          // Check if user is already mapped as cohort admin or not
          const userRoleMap = await this.userRoleMappingRepository.findOne({
            where: { userId, roleId: role.roleId },
          });

          const cohortMember = await this.cohortMembersRepository.findOne({
            where: { cohortId: invitation.cohortId, userId },
          })

          if (userRoleMap && cohortMember) {
            const error = API_RESPONSES.INVITEE_ALREADY_MAPPED;
            return APIResponse.error(
              response,
              apiId,
              API_RESPONSES.INVITEE_ALREADY_MAPPED,
              error,
              HttpStatus.CONFLICT
            );
          }

          // Assign user to tenant with appropriate role
          const tenantsData = {
            tenantRoleMapping: {
              tenantId: invitation.tenantId,
              roleId: role.roleId,
            },
            userId: userId,
          };

          await this.postgresUserService.assignUserToTenant(tenantsData, null);

          // Add user as cohort member
          const cohortData = {
            userId: userId,
            cohortId: invitation.cohortId,
          };

          await this.postgresUserService.addCohortMember(cohortData);
        }
      } else if (invitation.invitedBy !== email) {
        const errorMessage = API_RESPONSES.UNAUTHORIZED_TO_REVOKE
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.UNAUTHORIZED_TO_REVOKE,
          errorMessage,
          HttpStatus.UNAUTHORIZED
        )
      } else if (invitation.invitationStatus !== "Pending") {
        const errorMessage = API_RESPONSES.REVOKE_ONLY_PENDING
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.REVOKE_ONLY_PENDING,
          errorMessage,
          HttpStatus.UNAUTHORIZED
        )
      }

      // update invitation status
      const result = await this.invitationsRepository.update(
        invitationId,
        updateInvitationDto
      );

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.INVITATION_UPDATED
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}