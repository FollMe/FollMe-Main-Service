import { IsNotEmpty, IsOptional, IsEmail, IsString, MaxLength } from "class-validator";
import { MAX_GROUP_NAME } from "../invitation.constants";

export class GuestDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @IsOptional()
  email: String;

  /** "Nhà trai", "Bạn bè"... for headcounts per side. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME, { message: `Tên nhóm tối đa ${MAX_GROUP_NAME} ký tự` })
  group?: string;
}
