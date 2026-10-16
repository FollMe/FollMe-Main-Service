import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { MAX_SHUTTLE_FROM, MAX_SHUTTLE_LABEL, MAX_SHUTTLE_SEATS } from "../invitation.constants";

/**
 * A bus for guests: "Xe từ TP.HCM", leaving at "06:00" (Vietnam time) from
 * "Ngã tư Hàng Xanh", 45 seats. `_id` keeps an existing bus (guests on it stay).
 */
export class ShuttleDTO {
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên chuyến xe' })
  @MaxLength(MAX_SHUTTLE_LABEL, { message: `Tên chuyến xe tối đa ${MAX_SHUTTLE_LABEL} ký tự` })
  label: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ xe chạy không hợp lệ' })
  time: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHUTTLE_FROM, { message: `Điểm đón tối đa ${MAX_SHUTTLE_FROM} ký tự` })
  from?: string;

  @IsInt({ message: 'Số chỗ không hợp lệ' })
  @Min(1, { message: 'Số chỗ không hợp lệ' })
  @Max(MAX_SHUTTLE_SEATS, { message: `Mỗi xe tối đa ${MAX_SHUTTLE_SEATS} chỗ` })
  seats: number;
}
