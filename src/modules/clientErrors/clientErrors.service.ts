import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientError, ClientErrorDocument } from './clientError.schema';
import { ClientErrorDTO } from './clientError.dto';

@Injectable()
export class ClientErrorsService {
  constructor(
    @InjectModel(ClientError.name)
    private readonly clientErrorModel: Model<ClientErrorDocument>,
  ) { }

  async record(body: ClientErrorDTO, userAgent?: string) {
    await this.clientErrorModel.create({
      message: body.message.trim(),
      stack: body.stack,
      // A full URL or one with a query is cut to its path
      path: body.path?.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/, ''),
      userAgent: userAgent?.slice(0, 300),
    });
  }
}
