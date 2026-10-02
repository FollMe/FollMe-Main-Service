import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientErrorDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;
}
