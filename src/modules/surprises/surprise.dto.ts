import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MASCOTS,
  MAX_GIFTS,
  MAX_GIFT_EMOJI,
  MAX_GIFT_NOTE,
  MAX_GIFT_TITLE,
  MAX_HINT,
  MAX_MESSAGE,
  MAX_NAME,
  MAX_PASSWORD,
  MAX_PICK_NOTE,
  MIN_GIFTS,
  MIN_PASSWORD,
} from './surprise.schema';

export class SurpriseGiftDTO {
  /** Keeps an existing gift. */
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên món quà' })
  @MaxLength(MAX_GIFT_TITLE, {
    message: `Tên quà tối đa ${MAX_GIFT_TITLE} ký tự`,
  })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GIFT_NOTE, { message: `Mô tả tối đa ${MAX_GIFT_NOTE} ký tự` })
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GIFT_EMOJI)
  emoji?: string;
}

/** Everything is optional on update; on create the service checks what is required. */
export class SurpriseDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên người nhận' })
  @MaxLength(MAX_NAME)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE, { message: `Lời nhắn tối đa ${MAX_MESSAGE} ký tự` })
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_HINT, { message: `Gợi ý tối đa ${MAX_HINT} ký tự` })
  hint?: string;

  /** Set or change the password; left out keeps it. */
  @IsOptional()
  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự`,
  })
  @MaxLength(MAX_PASSWORD, { message: `Mật khẩu tối đa ${MAX_PASSWORD} ký tự` })
  password?: string;

  @IsOptional()
  @IsIn(MASCOTS)
  mascot?: string;

  /** null opens it at once. */
  @IsOptional()
  @IsDateString()
  opensAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(MIN_GIFTS, { message: `Cần ít nhất ${MIN_GIFTS} món để chọn` })
  @ArrayMaxSize(MAX_GIFTS, { message: `Tối đa ${MAX_GIFTS} món` })
  @ValidateNested({ each: true })
  @Type(() => SurpriseGiftDTO)
  gifts?: SurpriseGiftDTO[];
}

export class UnlockDTO {
  @IsString()
  @IsNotEmpty({ message: 'Nhập mật khẩu nha' })
  @MaxLength(MAX_PASSWORD * 2)
  password: string;
}

export class PickDTO extends UnlockDTO {
  @IsMongoId()
  giftId: string;

  /** A few words for the owner. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PICK_NOTE, {
    message: `Lời nhắn tối đa ${MAX_PICK_NOTE} ký tự`,
  })
  note?: string;
}
