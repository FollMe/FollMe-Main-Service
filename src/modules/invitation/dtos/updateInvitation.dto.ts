import { Type } from "class-transformer";
import { IsNotEmpty, IsArray, ArrayMaxSize, IsOptional, IsDateString, IsIn, MaxLength, IsBoolean, ValidateNested, IsInt, Min, Max } from "class-validator";
import { GuestDTO } from "./guest.dto";
import { GiftDTO } from "./gift.dto";
import { EVENT_MUSIC, EVENT_THEMES, EVENT_TYPES, MAX_GIFT_ACCOUNTS, MAX_GUESTS_PER_REQUEST, MAX_SEATS_PER_TABLE } from "../invitation.constants";

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

  /** Background music on the invitation. */
  @IsOptional()
  @IsIn(EVENT_MUSIC)
  music?: string;

  /** Hide the date on the cover under a scratch-off foil. */
  @IsOptional()
  @IsBoolean()
  scratchDate?: boolean;

  /** Seats at each table, for the seating plan. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(MAX_SEATS_PER_TABLE)
  seatsPerTable?: number;

  /** Bank accounts for wedding gifts; an empty list removes them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GIFT_ACCOUNTS)
  @ValidateNested({ each: true })
  @Type(() => GiftDTO)
  gifts?: GiftDTO[];

  /** New guests to invite (emails are sent like on creation). */
  @IsOptional()
  @IsArray()
  // Each guest with an email gets a mail from our Gmail account.
  @ArrayMaxSize(MAX_GUESTS_PER_REQUEST, { message: `Mỗi lần mời tối đa ${MAX_GUESTS_PER_REQUEST} khách` })
  @ValidateNested({ each: true })
  @Type(() => GuestDTO)
  addGuests?: GuestDTO[];
}
