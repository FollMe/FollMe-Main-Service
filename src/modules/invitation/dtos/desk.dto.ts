import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MAX_GROUP_NAME, MAX_RSVP_COUNT } from "../invitation.constants";

/** The reception desk checks a guest in (or undoes it). */
export class ArrivalDTO {
  @IsBoolean()
  arrived: boolean;

  /** How many people came, the guest included. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RSVP_COUNT)
  count?: number;
}

/** Someone not on the list, added and checked in at the desk. */
export class WalkInDTO {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên khách' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RSVP_COUNT)
  count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME, { message: `Tên nhóm tối đa ${MAX_GROUP_NAME} ký tự` })
  group?: string;
}
