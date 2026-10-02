import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** For uptime monitors: 200 when the service can reach its database. */
  @Get('api/health')
  async health() {
    try {
      if (this.connection.readyState !== 1) {
        throw new Error(`readyState ${this.connection.readyState}`);
      }
      await this.connection.db.admin().ping();
    } catch (err) {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
