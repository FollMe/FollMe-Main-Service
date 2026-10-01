import { IsNotEmpty, IsOptional, MaxLength } from "class-validator";

export class WishDTO {
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  /** Required on the public link; ignored on a personal link. */
  @IsOptional()
  @MaxLength(50)
  name?: string;
}
