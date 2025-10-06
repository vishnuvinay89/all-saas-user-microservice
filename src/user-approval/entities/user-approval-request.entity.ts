import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user-entity";

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity({ name: "UserApprovalRequests" })
export class UserApprovalRequest {
  @PrimaryGeneratedColumn("uuid")
  approvalId: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "text" })
  tenantName: string;

  @Column({ type: 'text', nullable: true })
  domain: string | null; 

  @Column({
    type: "enum",
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @CreateDateColumn({
    type: "timestamp with time zone",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: "timestamp with time zone",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: User;
}
