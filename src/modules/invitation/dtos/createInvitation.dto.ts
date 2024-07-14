import { Type } from "class-transformer";
import { IsNotEmpty, IsArray, IsOptional, IsDateString, IsEmail, IsObject, ValidateNested } from "class-validator";
import { GuestDTO } from "./guest.dto";

export class CreateInvitationDTO {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  location: string;

  @IsOptional()
  mapLocation: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestDTO)
  guests: GuestDTO[];
}
