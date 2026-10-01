import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class RequestCodeDTO {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @MaxLength(254)
    email: string;
}

export class SignUpDTO extends RequestCodeDTO {
    // A number from the form's numeric input, or a string.
    @IsNotEmpty({ message: 'Yêu cầu mã xác thực' })
    code: string | number;

    // bcrypt only uses the first 72 bytes.
    @IsString()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 kí tự' })
    @MaxLength(72, { message: 'Mật khẩu tối đa 72 kí tự' })
    password: string;
}
