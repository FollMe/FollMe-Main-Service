import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogService } from '../modules/logsConfig/logs.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logService: LogService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    return next
      .handle()
      .pipe(tap(() => {
        this.logService.createOne({
          location: `[${request.method}] ${request.url}`,
          slEmail: request.user?.slEmail,
          responseCode: context.switchToHttp().getResponse().statusCode,
          userAgent: request.headers['user-agent'],
          browser: request.headers['sec-ch-ua'],
        })
      }));
  }
}
