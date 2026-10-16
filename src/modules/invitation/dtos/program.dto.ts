import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import { MAX_PROGRAM_LABEL } from "../invitation.constants";

/** A moment of the day ("18:00", "Khai tiệc"), in Vietnam time on the event's day. */
export class ProgramItemDTO {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ không hợp lệ' })
  time: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PROGRAM_LABEL)
  label: string;
}
