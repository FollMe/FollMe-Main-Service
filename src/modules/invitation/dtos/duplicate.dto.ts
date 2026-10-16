import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";

/** A copy of an event for another ceremony; anything left out stays as it is. */
export class DuplicateEventDTO {
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(300)
  location?: string;

  @IsOptional()
  @MaxLength(1000)
  mapLocation?: string;

  /** Invite the same guests (new personal links, nothing sent). */
  @IsOptional()
  @IsBoolean()
  copyGuests?: boolean;
}
