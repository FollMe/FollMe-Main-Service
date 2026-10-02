import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientError, ClientErrorSchema } from './clientError.schema';
import { ClientErrorsController } from './clientErrors.controller';
import { ClientErrorsService } from './clientErrors.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ClientError.name, schema: ClientErrorSchema }])],
  controllers: [ClientErrorsController],
  providers: [ClientErrorsService],
})
export class ClientErrorsModule { }
