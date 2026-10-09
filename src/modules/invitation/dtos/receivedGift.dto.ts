import { Type } from "class-transformer";
import { IsDefined, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { MAX_GIFT_AMOUNT, MAX_GIFT_NOTE, MAX_GROUP_NAME } from "../invitation.constants";

/** A line of the gift ledger: money in VND, or a note for anything else. */
export class ReceivedGiftDTO {
  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GIFT_NOTE, { message: `Ghi chú tối đa ${MAX_GIFT_NOTE} ký tự` })
  note?: string;
}

/** A gift from someone who is not on the guest list: they are added with it. */
export class GiftGiverDTO {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên người mừng' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME, { message: `Tên nhóm tối đa ${MAX_GROUP_NAME} ký tự` })
  group?: string;

  @IsDefined({ message: 'Vui lòng nhập số tiền hoặc ghi chú' })
  @ValidateNested()
  @Type(() => ReceivedGiftDTO)
  gift: ReceivedGiftDTO;
}
