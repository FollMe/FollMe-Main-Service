import { IsNotEmpty, IsArray, IsOptional, IsDateString, IsEmail } from "class-validator";

export class CreateInvitationDTO {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  location: string;

  @IsOptional()
  mapLocation: string;

  @IsDateString()
  startAt: string;

  @IsArray()
  @IsEmail({} , { each: true })
  @IsOptional()
  guests: String[];
}
