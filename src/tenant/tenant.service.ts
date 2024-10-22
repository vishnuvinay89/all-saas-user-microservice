import { HttpStatus, Injectable } from '@nestjs/common';
import { Tenants } from './entities/tenant.entity';
import { Repository } from 'typeorm';
import APIResponse from "src/common/responses/response";
import { InjectRepository } from '@nestjs/typeorm';
import { API_RESPONSES } from '@utils/response.messages';
import { APIID } from '@utils/api-id.config';


@Injectable()
export class TenantService {
    constructor(
        @InjectRepository(Tenants)
        private tenantRepository: Repository<Tenants>,
    ) { }

    public async getTenants(request, response) {
        let apiId = APIID.TENANT_LIST;
        try {
            let result = await this.tenantRepository.find();
            if (result.length == 0) {
                return APIResponse.error(
                    response,
                    apiId,
                    API_RESPONSES.NOT_FOUND,
                    API_RESPONSES.TENANT_NOT_FOUND,
                    HttpStatus.NOT_FOUND
                );
            }
            return APIResponse.success(
                response,
                apiId,
                result,
                HttpStatus.OK,
                API_RESPONSES.TENANT_GET
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

    public async createTenants(request, tenantCreateDto, response) {
        let apiId = APIID.TENANT_CREATE;
        try {
            let checkExitTenants = await this.tenantRepository.find({
                where: {
                    "name": tenantCreateDto?.name
                }
            }
            )
            if (checkExitTenants.length > 0) {
                return APIResponse.error(
                    response,
                    apiId,
                    API_RESPONSES.CONFLICT,
                    API_RESPONSES.TENANT_EXISTS,
                    HttpStatus.CONFLICT
                );
            }
            let result = await this.tenantRepository.save(tenantCreateDto);
            return APIResponse.success(
                response,
                apiId,
                result,
                HttpStatus.CREATED,
                API_RESPONSES.TENANT_CREATE
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

    public async deleteTenants(request, tenantId, response) {
        let apiId = APIID.TENANT_DELETE;
        try {
            let checkExitTenants = await this.tenantRepository.find({
                where: {
                    "tenantId": tenantId
                }
            }
            )
            if (checkExitTenants.length === 0) {
                return APIResponse.error(
                    response,
                    apiId,
                    API_RESPONSES.CONFLICT,
                    API_RESPONSES.TENANT_EXISTS,
                    HttpStatus.CONFLICT
                );
            }

            let result = await this.tenantRepository.delete(tenantId);
            return APIResponse.success(
                response,
                apiId,
                result,
                HttpStatus.OK,
                API_RESPONSES.TENANT_DELETE,
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

    public async updateTenants(request, tenantId, response) {
        let apiId = APIID.TENANT_UPDATE;
        try {
            if (request.body.tenantId && request.body.tenantId !== tenantId) {
                return APIResponse.error(
                    response,
                    apiId,
                    API_RESPONSES.CONFLICT,
                    API_RESPONSES.TENANTID_CANNOT_BE_CHANGED,
                    HttpStatus.CONFLICT
                );
            }
            let checkExitTenants = await this.tenantRepository.find({
                where: {
                    "tenantId": tenantId
                }
            }
            )
            if (checkExitTenants.length === 0) {
                return APIResponse.error(
                    response,
                    apiId,
                    API_RESPONSES.CONFLICT,
                    API_RESPONSES.TENANT_EXISTS,
                    HttpStatus.CONFLICT
                );
            }

            let result = await this.tenantRepository.update(
                tenantId,
                request.body
            );
            return APIResponse.success(
                response,
                apiId,
                result,
                HttpStatus.OK,
                API_RESPONSES.TENANT_UPDATE
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