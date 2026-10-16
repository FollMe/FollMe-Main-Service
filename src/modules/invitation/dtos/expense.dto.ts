import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { EXPENSE_CATEGORIES, EXPENSE_PAYERS, MAX_EXPENSE_LABEL, MAX_EXPENSE_NOTE, MAX_GIFT_AMOUNT } from "../invitation.constants";

/** A line of the budget: what it is for, its cost and how much is paid (VND). */
export class ExpenseDTO {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập khoản chi' })
  @MaxLength(MAX_EXPENSE_LABEL, { message: `Tên khoản chi tối đa ${MAX_EXPENSE_LABEL} ký tự` })
  label: string;

  @IsIn(EXPENSE_CATEGORIES)
  category: string;

  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  amount?: number;

  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  paid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXPENSE_NOTE, { message: `Ghi chú tối đa ${MAX_EXPENSE_NOTE} ký tự` })
  note?: string;

  /** Nhà trai, nhà gái, or both halves; none when the couple pays. */
  @IsOptional()
  @IsIn(EXPENSE_PAYERS)
  payer?: string;
}

/** Only the given fields change; null clears the cost, the paid amount or the note. */
export class UpdateExpenseDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập khoản chi' })
  @MaxLength(MAX_EXPENSE_LABEL, { message: `Tên khoản chi tối đa ${MAX_EXPENSE_LABEL} ký tự` })
  label?: string;

  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  amount?: number | null;

  @IsOptional()
  @IsInt({ message: 'Số tiền không hợp lệ' })
  @Min(0, { message: 'Số tiền không hợp lệ' })
  @Max(MAX_GIFT_AMOUNT, { message: 'Số tiền quá lớn' })
  paid?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXPENSE_NOTE, { message: `Ghi chú tối đa ${MAX_EXPENSE_NOTE} ký tự` })
  note?: string | null;

  @IsOptional()
  @IsIn(EXPENSE_PAYERS)
  payer?: string | null;
}
