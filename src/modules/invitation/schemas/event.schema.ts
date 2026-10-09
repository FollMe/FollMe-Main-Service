import { Schema } from 'mongoose';
import { EVENT_MUSIC, EVENT_THEMES, EVENT_TYPES, GIFT_SIDES, PURGE_AFTER_SECONDS } from '../invitation.constants';

export class Event {
  title: string;
  location: string;
  mapLocation: string;
  startAt: Date;
  host: string;
  isDeleted: boolean;
  deletedAt?: Date;
  type: string;
  theme: string;
  groomName: string;
  brideName: string;
  message: string;
  allowPublicLink: boolean;
  publicViews: number;
  music?: string;
  scratchDate?: boolean;
  gifts?: Gift[];
  photos?: Photo[];
  screenKey?: string;
  deskKey?: string;
  guest: any;
}

/** A wedding photo on Cloudinary. The first one is the cover. */
export class Photo {
  _id?: unknown;
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export class Gift {
  side: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

const GiftSchema = new Schema({
  side: { type: String, enum: GIFT_SIDES, required: true },
  bankBin: { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName: { type: String, default: '' },
}, { _id: false });

const PhotoSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  width: { type: Number },
  height: { type: Number },
});

export const EventSchema = new Schema({
  title: { type: String, require: true },
  location: { type: String, require: true },
  mapLocation: { type: String },
  startAt: { type: Date },
  host: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  // Set when the host deletes it: removed for good PURGE_AFTER_SECONDS later
  deletedAt: { type: Date },
  type: { type: String, enum: EVENT_TYPES, default: 'other' },
  theme: { type: String, enum: EVENT_THEMES, default: 'minimal' },
  groomName: { type: String, default: '' },
  brideName: { type: String, default: '' },
  message: { type: String, default: '' },
  // One link anyone can open (e.g. shared in a Zalo group), on top of the
  // personal per-guest links. Off for events created before it existed.
  allowPublicLink: { type: Boolean, default: false },
  publicViews: { type: Number, default: 0 },
  // Unset on older events: the invitation picks a default by event type.
  music: { type: String, enum: EVENT_MUSIC },
  scratchDate: { type: Boolean },
  gifts: { type: [GiftSchema], default: undefined },
  photos: { type: [PhotoSchema], default: undefined },
  // Secret part of the venue screen link (shown on a TV at the party, run
  // by whoever the host sends the link to). Never sent to guests.
  screenKey: { type: String, select: false },
  // Secret part of the reception desk link, for whoever welcomes guests at
  // the party: sees names and groups, checks guests in. Never sent to guests.
  deskKey: { type: String, select: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// "Thiệp của tôi": the host's events, latest first
EventSchema.index({ host: 1, startAt: -1 });
EventSchema.index({ deletedAt: 1 }, { expireAfterSeconds: PURGE_AFTER_SECONDS });

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
