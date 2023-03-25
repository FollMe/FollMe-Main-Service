import { IsArray, IsString, MinLength } from "class-validator";

export class GetProfilesDTO {
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids: string[]
}
