import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  logger: Logger = new Logger(AllExceptionsFilter.name);
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
  ) { }

  catch(exception: any, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    this.logger.error(exception);

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      meta: {
        ok: false,
        message: mappingErrorMessages(httpStatus, messageOf(exception))
      }
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

/**
 * The message to show. ValidationPipe errors carry their messages in an
 * array on the response, while `exception.message` is just
 * "Bad Request Exception".
 */
export function messageOf(exception: any): string {
  if (exception instanceof HttpException) {
    const res: any = exception.getResponse();
    if (Array.isArray(res?.message) && res.message.length > 0) {
      return String(res.message[0]);
    }
    if (typeof res?.message === 'string') {
      return res.message;
    }
  }
  return exception?.message;
}

export function mappingErrorMessages(httpStatus, message) {
  if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'Xảy ra lỗi, vui lòng thử lại!';
  }
  if (message === 'Unauthorized') {
    return 'Vui lòng đăng nhập!'
  }

  return message;
}
