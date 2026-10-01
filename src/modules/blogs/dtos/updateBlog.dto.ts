import { IsOptional, MinLength } from "class-validator";
import { MIN_CONTENT_CHARACTER, MIN_TITLE_CHARACTER } from "../blogs.instant";

export class UpdateBlogDTO {
    @IsOptional()
    @MinLength(MIN_TITLE_CHARACTER)
    title?: string;

    @IsOptional()
    @MinLength(MIN_CONTENT_CHARACTER)
    content?: string;
}
