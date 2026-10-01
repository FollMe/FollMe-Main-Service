import { BadRequestException, HttpStatus, NotFoundException, ValidationPipe } from '@nestjs/common';
import { mappingErrorMessages, messageOf } from './allException.filter';
import { SignUpDTO } from './modules/auth/dtos/signUp.dto';

describe('messageOf', () => {
  it('shows the first validation message instead of "Bad Request Exception"', async () => {
    const pipe = new ValidationPipe();
    const err = await pipe
      .transform({ email: 'minh@gmail.com', code: '123456', password: '123' }, { type: 'body', metatype: SignUpDTO })
      .catch(e => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(messageOf(err)).toBe('Mật khẩu phải có ít nhất 6 kí tự');
  });

  it('keeps plain messages', () => {
    expect(messageOf(new BadRequestException('Vui lòng nhập lời chúc'))).toBe('Vui lòng nhập lời chúc');
    expect(messageOf(new Error('boom'))).toBe('boom');
  });

  it('hides internal errors', () => {
    expect(mappingErrorMessages(HttpStatus.INTERNAL_SERVER_ERROR, 'db down')).toBe('Xảy ra lỗi, vui lòng thử lại!');
    expect(mappingErrorMessages(HttpStatus.NOT_FOUND, messageOf(new NotFoundException()))).toBe('Not Found');
  });
});
