import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsMongoId, IsString, MaxLength, ValidateNested } from "class-validator";
import { MAX_GUESTS_PER_REQUEST, MAX_TABLE_NAME } from "../invitation.constants";

export class SeatDTO {
  @IsMongoId()
  guest: string;

  /** Empty to take the guest off their table. */
  @IsString()
  @MaxLength(MAX_TABLE_NAME, { message: `Tên bàn tối đa ${MAX_TABLE_NAME} ký tự` })
  table: string;
}

/** Many guests seated at once (the automatic seating plan). */
export class SeatingDTO {
  @IsArray()
  @ArrayMaxSize(MAX_GUESTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => SeatDTO)
  seats: SeatDTO[];
}
