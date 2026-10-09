import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { MAX_GROUP_NAME } from "../invitation.constants";
import { ReceivedGiftDTO } from "./receivedGift.dto";

/**
 * The host fixes a guest's name or group, marks their invitation or
 * reminder sent, or writes what they gave in the gift ledger.
 */
export class UpdateGuestDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  sent?: boolean;

  @IsOptional()
  @IsBoolean()
  reminded?: boolean;

  /** Empty to take the guest out of their group. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME, { message: `Tên nhóm tối đa ${MAX_GROUP_NAME} ký tự` })
  group?: string;

  /** null (or nothing in it) takes the guest out of the gift ledger. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ReceivedGiftDTO)
  gift?: ReceivedGiftDTO | null;
}
