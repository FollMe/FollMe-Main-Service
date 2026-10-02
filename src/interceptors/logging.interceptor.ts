import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogService } from '../modules/logsConfig/logs.service';
import { getRequestIdentity } from 'src/utils/requestHepler';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
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
          }).catch(err => {
            // Losing an access log must not fail, or crash, the request.
            this.logger.warn(`Writing access log failed: ${err?.message ?? err}`);
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
    // Uptime checks, error reports (stored on their own), and the venue
    // screen polling every few seconds
    if (request.url.startsWith('/api/health') || request.url.startsWith('/api/client-errors') || /^\/api\/events\/[^/]+\/screen\/[^/?]+\?since=/.test(request.url)) {
      return false
    }

    return true
  }
}
