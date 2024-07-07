import { IsNotEmpty, IsOptional, IsEmail } from "class-validator";

export class GuestDTO {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email: String;
}
