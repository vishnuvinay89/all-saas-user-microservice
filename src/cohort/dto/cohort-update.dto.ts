import { Exclude, Expose, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsDateString
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FieldValuesOptionDto } from "src/user/dto/user-create.dto";


export class CohortUpdateDto {
  @Expose()
  cohortId: string;

  @Expose()
  tenantId: string;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  //programId
  // @ApiPropertyOptional({
  //   type: String,
  //   description: "The programId of the cohort",
  // })
  // @Expose()
  // programId: string;

  //parentId
  @ApiPropertyOptional({
    type: String,
    description: "The parentId of the cohort",
  })
  @Expose()
  parentId: string;

  //referenceId
  // @Expose()
  // referenceId: string;

  //name
  @ApiPropertyOptional({
    type: String,
    description: "The name of the cohort",
  })
  @Expose()
  name: string;

  //type
  @ApiPropertyOptional({
    type: String,
    description: "The type of the cohort",
  })
  @Expose()
  type: string;

  //status

  // @Expose()
  // status: boolean;


  @ApiProperty({
    type: String,
    description: "The status of Cohort",
  })
  @IsOptional()
  @IsEnum(['active', 'archived', 'inactive'], {
    message: 'Status must be one of: active, archived, inactive',
  })
  @Expose()
  status: string;

  //attendanceCaptureImage
  // @Expose()
  // attendanceCaptureImage: boolean;

  //image need for future
  // @Expose()
  // @ApiPropertyOptional({ type: "string", format: "binary" })
  // image: string;

  //metadata
  // @Expose()
  // metadata: string;

  //createdBy
  @Expose()
  createdBy: string;

  //updatedBy
  @Expose()
  updatedBy: string;

  @ApiPropertyOptional({
    type: Date,
    description: "The expiry date of the cohort",
    required: false
  })
  @Expose()
  @IsOptional()
  @IsDateString()
  expiryDate: Date;

  //fieldValues
  @ApiPropertyOptional({
    type: [FieldValuesOptionDto],
    description: "The fieldValues Object",
  })
  @ValidateNested({ each: true })
  @Type(() => FieldValuesOptionDto)
  customFields: FieldValuesOptionDto[];


  constructor(obj?: Partial<CohortUpdateDto>) {
    if (obj) {
      Object.assign(this, obj);
    }
  }
}
