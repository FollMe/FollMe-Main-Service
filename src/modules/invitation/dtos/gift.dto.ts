import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { GIFT_SIDES } from "../invitation.constants";

/** A bank account guests can send a wedding gift to (shown as a VietQR code). */
export class GiftDTO {
  @IsIn(GIFT_SIDES)
  side: string;

  // NAPAS bank identification number
  @Matches(/^\d{6}$/, { message: 'Ngân hàng không hợp lệ' })
  bankBin: string;

  @Matches(/^[0-9A-Za-z]{4,19}$/, { message: 'Số tài khoản không hợp lệ' })
  accountNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountName?: string;
}
