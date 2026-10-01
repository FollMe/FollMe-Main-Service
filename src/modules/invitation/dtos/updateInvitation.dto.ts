import { Type } from "class-transformer";
import { IsNotEmpty, IsArray, IsOptional, IsDateString, IsIn, MaxLength, IsBoolean, ValidateNested } from "class-validator";
import { GuestDTO } from "./guest.dto";
import { EVENT_THEMES, EVENT_TYPES } from "../invitation.constants";

/** Every field is optional; only the given ones change. */
export class UpdateInvitationDTO {
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(300)
  location?: string;

  @IsOptional()
  @MaxLength(1000)
  mapLocation?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(EVENT_THEMES)
  theme?: string;

  @IsOptional()
  @MaxLength(50)
  groomName?: string;

  @IsOptional()
  @MaxLength(50)
  brideName?: string;

  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsBoolean()
  allowPublicLink?: boolean;

  /** New guests to invite (emails are sent like on creation). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestDTO)
  addGuests?: GuestDTO[];
}
