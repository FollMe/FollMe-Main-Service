import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { MAX_NOTE_TEXT, MAX_NOTE_TITLE, NOTE_KINDS } from "../invitation.constants";

/** A note for guests: a known topic ("dress", "parking"...) or the host's own title, and a few lines. */
export class NoteDTO {
  @IsIn(NOTE_KINDS)
  kind: string;

  /** Only for 'other': the topic as the host names it. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_TITLE, { message: `Tiêu đề tối đa ${MAX_NOTE_TITLE} ký tự` })
  title?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung lưu ý' })
  @MaxLength(MAX_NOTE_TEXT, { message: `Mỗi lưu ý tối đa ${MAX_NOTE_TEXT} ký tự` })
  text: string;
}
