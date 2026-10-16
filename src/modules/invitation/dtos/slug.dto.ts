import { IsString, Matches, MaxLength, ValidateIf, MinLength } from "class-validator";
import { MAX_SLUG, MIN_SLUG, SLUG_RE } from "../invitation.constants";

/** The short link of the shared card ("minh-lan"); empty removes it. */
export class SlugDTO {
  @IsString()
  @ValidateIf(o => o.slug !== '')
  @MinLength(MIN_SLUG, { message: `Link cần ít nhất ${MIN_SLUG} ký tự` })
  @MaxLength(MAX_SLUG, { message: `Link tối đa ${MAX_SLUG} ký tự` })
  @Matches(SLUG_RE, { message: 'Link chỉ gồm chữ thường không dấu, số và dấu gạch ngang' })
  slug: string;
}
