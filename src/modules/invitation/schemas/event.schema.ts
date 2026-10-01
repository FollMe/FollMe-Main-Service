import { Schema } from 'mongoose';
import { EVENT_THEMES, EVENT_TYPES } from '../invitation.constants';

export class Event {
  title: string;
  location: string;
  mapLocation: string;
  startAt: Date;
  host: string;
  isDeleted: boolean;
  type: string;
  theme: string;
  groomName: string;
  brideName: string;
  message: string;
  allowPublicLink: boolean;
  publicViews: number;
  guest: any;
}

export const EventSchema = new Schema({
  title: { type: String, require: true },
  location: { type: String, require: true },
  mapLocation: { type: String },
  startAt: { type: Date },
  host: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  type: { type: String, enum: EVENT_TYPES, default: 'other' },
  theme: { type: String, enum: EVENT_THEMES, default: 'minimal' },
  groomName: { type: String, default: '' },
  brideName: { type: String, default: '' },
  message: { type: String, default: '' },
  // One link anyone can open (e.g. shared in a Zalo group), on top of the
  // personal per-guest links. Off for events created before it existed.
  allowPublicLink: { type: Boolean, default: false },
  publicViews: { type: Number, default: 0 },
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
