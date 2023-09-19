import { Schema } from 'mongoose';

export class Event {
  title: string;
  location: string;
  mapLocation: string;
  startAt: Date;
  host: string;
  isDelete: boolean;
  guest: any;
}

export const EventSchema = new Schema({
  title: { type: String, require: true },
  location: { type: String, require: true },
  mapLocation: { type: String },
  startAt: { type: Date },
  host: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

EventSchema.virtual('guests', {
  ref: 'Guest',
  localField: '_id',
  foreignField: 'event',
  match: { isDeleted: { $ne: true } }
});

EventSchema.virtual('numGuests', {
  ref: 'Guest',
  localField: '_id',
  foreignField: 'event',
  match: { isDeleted: { $ne: true } },
  count: true
});

export type EventDocument = Event & Document;
