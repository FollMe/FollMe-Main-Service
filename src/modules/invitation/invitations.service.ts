import * as path from 'path';
import * as fs from 'fs';
import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { Guest, GuestDocument } from './schemas/guest.schema';
import * as mongoose from 'mongoose';
import { MailerService } from 'src/sharedServices/mailer.service';
import Handlebars from 'handlebars';

const templateStr = fs.readFileSync(path.resolve(process.cwd(), 'src/templates/sendInvitation.template.hbs')).toString('utf8')
const template = Handlebars.compile(templateStr);

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: mongoose.Model<EventDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: mongoose.Model<GuestDocument>,
    @InjectConnection()
    private readonly connection: mongoose.Connection,
    private readonly mailerService: MailerService,
  ) { }
  async getAll(userId: string) {
    return await this.eventModel.find({ isDeleted: { $ne: true }, host: userId })
      .select('-isDeleted -host')
      .populate('numGuests');
  }

  async findOne(eventId: string, userId: string) {
    if (!mongoose.isValidObjectId(eventId)) {
      throw new HttpException("Không tìm thấy tài nguyên!", HttpStatus.BAD_REQUEST);
    }

    const invitation = await this.eventModel.findOne({ isDeleted: { $ne: true }, host: userId, _id: eventId })
      .select('-isDeleted -host')
      .populate('guests', '_id mail viewed');

    if (!invitation) {
      throw new NotFoundException();
    }

    return invitation;
  }

  async findGuest(guestId: string) {
    if (!mongoose.isValidObjectId(guestId)) {
      throw new HttpException("Không tìm thấy tài nguyên!", HttpStatus.BAD_REQUEST);
    }

    const invitation = await this.guestModel.findOneAndUpdate({
      isDeleted: { $ne: true },
      _id: guestId
    }, {
      $inc: { viewed: 1 }
    }).select('-isDeleted')
      .populate('event', '-isDeleted');

    if (!invitation) {
      throw new NotFoundException();
    }

    return invitation;
  }

  async createOne(invitation: any, userId: string, slEmail: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const event = await new this.eventModel({
        ...invitation,
        host: userId
      }).save({ session })

      var guestList = []
      if (invitation.guests.length) {
        guestList = await this.guestModel.insertMany(invitation.guests.map(guest => ({
          event: event._id,
          name: guest.name,
          mail: guest.email
        })), {
          session
        })
      }
      await session.commitTransaction();

      // Send email to guests
      guestList.forEach(guest => {
        if (guest.mail) {
          this.mailerService.sendMail({
            from: '"FollMe " <follme.noreply@gmail.com>',
            to: guest.mail,
            subject: '[FollMe.eCard] Thư mời sự kiện',
            html: template({
              sender: slEmail,
              invitationUrl: `${process.env.FE_URL}/invitations/${guest._id}`
            })
          })
        }
      })

      return {
        _id: event._id,
      }
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
