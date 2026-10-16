import { IsIn, IsInt, IsNotEmpty, IsOptional, Max, MaxLength, Min } from "class-validator";
import { MAX_RSVP_COUNT, RSVP_STATUSES } from "../invitation.constants";

export class RsvpDTO {
  @IsIn(RSVP_STATUSES)
  status: string;

  /** How many people are coming, the guest included. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RSVP_COUNT)
  count?: number;

  /** How many of them eat vegetarian (suất chay); never more than come. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_RSVP_COUNT)
  vegetarian?: number;

  @IsOptional()
  @MaxLength(300)
  note?: string;
}

/** RSVP through the public link: the guest says who they are. */
export class PublicRsvpDTO extends RsvpDTO {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
