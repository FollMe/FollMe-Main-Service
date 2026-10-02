import { Schema } from 'mongoose';
import { RSVP_STATUSES } from '../invitation.constants';

export class Rsvp {
  status: string;
  count: number;
  note: string;
  respondedAt: Date;
}

export class Guest {
  name: string;
  mail: string;
  viewed: number;
  event: string;
  isDeleted: boolean;
  // 'host': added by the host; 'public': answered through the public link
  source: string;
  rsvp?: Rsvp;
  sentAt?: Date;
  remindedAt?: Date;
  group?: string;
}

const RsvpSchema = new Schema({
  status: { type: String, enum: RSVP_STATUSES, required: true },
  count: { type: Number, default: 1 },
  note: { type: String, default: '' },
  respondedAt: { type: Date },
}, { _id: false });

export const GuestSchema = new Schema({
  name: { type: String, require: true },
  mail: { type: String },
  viewed: { type: Number, require: true, default: 0 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', require: true },
  isDeleted: { type: Boolean, default: false },
  source: { type: String, enum: ['host', 'public'], default: 'host' },
  rsvp: { type: RsvpSchema, default: undefined },
  // When the host marked their personal link as sent (Zalo, Messenger...)
  sentAt: { type: Date },
  // When the host last sent them a reminder to answer
  remindedAt: { type: Date },
  // Set by the host: "Nhà trai", "Nhà gái", "Bạn bè"...
  group: { type: String },
}, { timestamps: true });

export type GuestDocument = Guest & Document;
