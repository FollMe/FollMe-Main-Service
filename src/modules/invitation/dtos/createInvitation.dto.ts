import { Type } from "class-transformer";
import { IsNotEmpty, IsArray, ArrayMaxSize, IsOptional, IsDateString, IsIn, MaxLength, IsBoolean, ValidateNested, IsInt, Min, Max } from "class-validator";
import { GuestDTO } from "./guest.dto";
import { GiftDTO } from "./gift.dto";
import { ProgramItemDTO } from "./program.dto";
import { StoryItemDTO } from "./story.dto";
import { EVENT_MUSIC, EVENT_THEMES, EVENT_TYPES, MAX_GIFT_ACCOUNTS, MAX_GIFT_AMOUNT, MAX_GUESTS_PER_REQUEST, MAX_PROGRAM_ITEMS, MAX_SEATS_PER_TABLE, MAX_STORY_ITEMS } from "../invitation.constants";

export class CreateInvitationDTO {
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsNotEmpty()
  @MaxLength(300)
  location: string;

  @IsOptional()
  @MaxLength(1000)
  mapLocation: string;

  @IsDateString()
  startAt: string;

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

  /** Answer by this date; null clears it. */
  @IsOptional()
  @IsDateString()
  rsvpBy?: string | null;

  /** Seats at each table, for the seating plan. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(MAX_SEATS_PER_TABLE)
  seatsPerTable?: number;

  /** What the host plans to spend in all (VND); null clears it. */
  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  budget?: number | null;

  /** Bank accounts for wedding gifts; an empty list removes them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GIFT_ACCOUNTS)
  @ValidateNested({ each: true })
  @Type(() => GiftDTO)
  gifts?: GiftDTO[];

  /** The program of the day, shown on the invitation; an empty list removes it. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PROGRAM_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ProgramItemDTO)
  program?: ProgramItemDTO[];

  /** The couple's story, in their order; an empty list removes it. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STORY_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => StoryItemDTO)
  story?: StoryItemDTO[];

  @IsOptional()
  @IsArray()
  // Each guest with an email gets a mail from our Gmail account.
  @ArrayMaxSize(MAX_GUESTS_PER_REQUEST, { message: `Mỗi lần mời tối đa ${MAX_GUESTS_PER_REQUEST} khách` })
  @ValidateNested({ each: true })
  @Type(() => GuestDTO)
  guests: GuestDTO[];
}
