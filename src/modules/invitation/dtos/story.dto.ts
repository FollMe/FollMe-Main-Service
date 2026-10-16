import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { MAX_STORY_TEXT, MAX_STORY_TITLE, MAX_STORY_WHEN } from "../invitation.constants";

/** A moment of the couple's story: "Mùa thu 2019" · "Lần đầu gặp nhau" · a few lines. */
export class StoryItemDTO {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_STORY_WHEN, { message: `Thời gian tối đa ${MAX_STORY_WHEN} ký tự` })
  when?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề' })
  @MaxLength(MAX_STORY_TITLE, { message: `Tiêu đề tối đa ${MAX_STORY_TITLE} ký tự` })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_STORY_TEXT, { message: `Mỗi đoạn tối đa ${MAX_STORY_TEXT} ký tự` })
  text?: string;
}
