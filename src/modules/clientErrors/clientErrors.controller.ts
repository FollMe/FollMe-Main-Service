import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ClientErrorsService } from './clientErrors.service';
import { ClientErrorDTO } from './clientError.dto';

@Controller('api')
export class ClientErrorsController {
  constructor(private readonly clientErrorsService: ClientErrorsService) { }

  /** Browsers report their JavaScript errors here (rate limited at the gateway). */
  @Post('client-errors')
  @HttpCode(200)
  async report(@Body() body: ClientErrorDTO, @Headers('user-agent') userAgent?: string) {
    await this.clientErrorsService.record(body, userAgent);
    return { ok: true };
  }
}
