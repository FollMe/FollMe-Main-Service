import { ArrayMaxSize, IsArray, IsMongoId } from "class-validator";
import { MAX_PHOTOS } from "../invitation.constants";

export class PhotoOrderDTO {
  /** Every photo id of the album, in the new order. */
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @IsMongoId({ each: true })
  order: string[];
}
