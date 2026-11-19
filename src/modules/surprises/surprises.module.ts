import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerService } from 'src/sharedServices/mailer.service';
import { Surprise, SurpriseSchema } from './surprise.schema';
import { SurprisesController } from './surprises.controller';
import { SurprisesService } from './surprises.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Surprise.name, schema: SurpriseSchema },
    ]),
  ],
  controllers: [SurprisesController],
  providers: [SurprisesService, MailerService],
})
export class SurprisesModule {}
