import { MinLength } from "class-validator";
import { MIN_CONTENT_CHARACTER, MIN_TITLE_CHARACTER } from "../blogs.instant";

export class CreateBlogDTO {
    @MinLength(MIN_TITLE_CHARACTER, { message: `Tiêu đề cần ít nhất ${MIN_TITLE_CHARACTER} ký tự` })
    title: string;

    @MinLength(MIN_CONTENT_CHARACTER, { message: `Nội dung cần ít nhất ${MIN_CONTENT_CHARACTER} ký tự` })
    content: string;
}
