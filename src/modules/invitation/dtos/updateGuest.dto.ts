import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { MAX_GROUP_NAME } from "../invitation.constants";

/** The host fixes a guest's name or group, or marks their invitation or reminder sent. */
export class UpdateGuestDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  sent?: boolean;

  @IsOptional()
  @IsBoolean()
  reminded?: boolean;

  /** Empty to take the guest out of their group. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME, { message: `Tên nhóm tối đa ${MAX_GROUP_NAME} ký tự` })
  group?: string;
}
