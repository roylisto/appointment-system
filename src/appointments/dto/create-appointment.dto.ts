import { IsString, IsNotEmpty, IsDate, IsOptional, IsInt } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  startTime: Date;

  @IsDate()
  endTime: Date;

  @IsInt()
  @IsNotEmpty()
  userId: number;
}
