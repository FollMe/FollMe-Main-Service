import { IsNotEmpty, IsOptional, IsEmail, IsString, MaxLength } from "class-validator";

export class GuestDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @IsOptional()
  email: String;
}
