import { IsString, IsOptional, IsDate, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAppointmentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @IsInt()
  @IsOptional()
  userId?: number;
}
