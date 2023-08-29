import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from './schemas/log.schema';

@Injectable()
export class LogService {
  constructor(
    @InjectModel(Log.name)
    private logModel: Model<LogDocument>,
  ) { }
  async createOne(data: Log) {
    return await this.logModel.create(data);
  }
}