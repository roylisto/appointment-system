import { IsString, IsOptional, IsDate, IsInt } from 'class-validator';

export class UpdateAppointmentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @IsOptional()
  startTime?: Date;

  @IsDate()
  @IsOptional()
  endTime?: Date;

  @IsInt()
  @IsOptional()
  userId?: number;
}
