import { Module } from '@nestjs/common';
import { invitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import { Guest, GuestSchema } from './schemas/guest.schema';

@Module({
  controllers: [invitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Event.name,
        useFactory: () => {
          const schema = EventSchema;
          schema.plugin(require('mongoose-slug-updater'));
          return schema;
        },
      },
      {
        name: Guest.name,
        useFactory: () => {
          const schema = GuestSchema;
          schema.plugin(require('mongoose-slug-updater'));
          return schema;
        },
      }
    ]),
  ]
})
export class InvitationModule { }
