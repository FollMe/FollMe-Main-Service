import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MAX_RSVP_COUNT, MAX_SONG, RSVP_STATUSES } from "../invitation.constants";

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

  /** A song they would like to hear at the party, for the band or DJ. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SONG, { message: `Tên bài hát tối đa ${MAX_SONG} ký tự` })
  song?: string;

  /** The bus they take (one of the event's shuttles), for everyone coming; empty for none. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  shuttle?: string;
}

/** RSVP through the public link: the guest says who they are. */
export class PublicRsvpDTO extends RsvpDTO {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
