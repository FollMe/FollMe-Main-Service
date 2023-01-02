import { MinLength } from "class-validator";
import { MIN_CONTENT_CHARACTER, MIN_TITLE_CHARACTER } from "../blogs.instant";

export class CreateBlogDTO {
    @MinLength(MIN_TITLE_CHARACTER)
    title: string;

    @MinLength(MIN_CONTENT_CHARACTER)
    content: string;
}
