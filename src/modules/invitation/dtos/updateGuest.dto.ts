import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/** The host fixes a guest's name or marks their invitation sent. */
export class UpdateGuestDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  sent?: boolean;
}
