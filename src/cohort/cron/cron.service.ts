import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Cohort } from 'src/cohort/entities/cohort.entity';
import { User, UserStatus } from 'src/user/entities/user-entity';
import { CohortMembers, MemberStatus } from 'src/cohortMembers/entities/cohort-member.entity';
import { PostgresUserService } from 'src/adapters/postgres/user-adapter';
import { Repository } from 'typeorm';
import { LessThan } from 'typeorm';

@Injectable()
export class CronService {
  constructor(
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CohortMembers)
    private cohortMembersRepository: Repository<CohortMembers>,
    private postgresUserService: PostgresUserService,
  ) {}

  // Get all active cohorts older than 30 days
  async getOldActiveCohorts() {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - parseInt(process.env.COHORT_EXPIRY_DAYS));
      console.log(dateThreshold)

      const cohorts = await this.cohortRepository.find({
        where: {
          status: 'active',
          createdAt: LessThan(dateThreshold),  // Only get those older than 30 days
        },
      });

      return cohorts;
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  }

  // Update the status to inactive
  async setInactive(cohortId: string) {
    try {
      await this.cohortRepository.update(cohortId, {
        status: 'inactive',
      });
    } catch (error) {
      console.error('Error updating cohort status:', error);
    }
  }
  async setUserInactive(cohortIds) {
    let filter = {
      "filters": {
          "role" : "learner",
          "status" : ["active"]
      },
      "tenantCohortRoleMapping": {
          "tenantId": cohortIds.tenantId,
          "cohortId": [cohortIds.cohortId]
      },
    }
    let userId = await this.postgresUserService.findAllUserDetails(filter)

    if(userId && userId.getUserDetails.length > 0) {
      let results = userId.getUserDetails;
      //get only the userids from userId
      let userIds = results.map(item => item.userId)
      //update the user status to inactive in user table
      await this.userRepository.update(userIds,{
        status : UserStatus.INACTIVE
      })
      await this.cohortMembersRepository.update(userIds,{
        status : MemberStatus.INACTIVE
      })

    }
  }


  @Cron(process.env.COHORT_CRON_EXPRESSION)
  async handleCron() {
    console.log('Running Cohort Inactive Status Check...');

    const oldCohorts = await this.getOldActiveCohorts();

    if (oldCohorts && oldCohorts.length > 0) {
      for (const cohort of oldCohorts) {
        await this.setInactive(cohort.cohortId);
        console.log(`Cohort with ID ${cohort.cohortId} set to inactive.`);
        await this.setUserInactive(cohort);
        console.log(`users mapped to cohortID ${cohort.cohortId} set to inactive.`);
      }
    } else {
      console.log('No cohorts to update.');
    }
  }
}

