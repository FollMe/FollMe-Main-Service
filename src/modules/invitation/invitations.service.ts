import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { Guest, GuestDocument } from './schemas/guest.schema';
import * as mongoose from 'mongoose';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: mongoose.Model<EventDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: mongoose.Model<GuestDocument>,
    @InjectConnection()
    private readonly connection: mongoose.Connection
  ) { }
  async getAll(userId: string) {
    return await this.eventModel.find({ isDeleted: { $ne: true }, host: userId })
      .select('-isDeleted -host')
      .populate('numGuests');
  }

  async findOne(eventId: string) {
    if (!mongoose.isValidObjectId(eventId)) {
      throw new HttpException("Invalid eventId", HttpStatus.BAD_REQUEST);
    }

    const invitation = await this.eventModel.findOne({ isDeleted: { $ne: true }, _id: eventId })
      .select('-isDeleted -host')
      .populate('guests', '_id mail viewed');

    if (!invitation) {
      throw new NotFoundException();
    }

    return invitation;
  }

  async createOne(invitation: any, userId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const event = await new this.eventModel({
        ...invitation,
        host: userId
      }).save({ session })

      if (Array.isArray(invitation.guests) && invitation.guests.length) {
        await this.guestModel.insertMany(invitation.guests.map(guest => ({
          event: event._id,
          mail: guest
        })), {
          session
        })
      }
      await session.commitTransaction();

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
