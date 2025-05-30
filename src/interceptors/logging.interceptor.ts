import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogService } from '../modules/logsConfig/logs.service';
import { getRequestIdentity } from 'src/utils/requestHepler';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logService: LogService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    return next
      .handle()
      .pipe(tap(() => {
        if (this.needLog(request)) {
          this.logService.createOne({
            location: `[${request.method}] ${request.url}`,
            slEmail: request.user?.slEmail,
            responseCode: context.switchToHttp().getResponse().statusCode,
            ...getRequestIdentity(request)
          })
        }
      }));
  }

  needLog(request: any): Boolean {
    if (request.method === 'HEAD') {
      return false
    }
    if (request.url.includes('/api/profiles')) {
      return false
    }

    return true
  }
}
