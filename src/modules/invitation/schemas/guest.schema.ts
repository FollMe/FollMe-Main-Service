import { Schema } from 'mongoose';
import { PURGE_AFTER_SECONDS, RSVP_STATUSES } from '../invitation.constants';

export class Rsvp {
  status: string;
  count: number;
  note: string;
  respondedAt: Date;
}

/** What a guest gave, as the host wrote it in their gift ledger (sổ mừng). */
export class ReceivedGift {
  amount?: number;
  note?: string;
  at: Date;
}

export class Guest {
  name: string;
  mail: string;
  viewed: number;
  event: string;
  isDeleted: boolean;
  deletedAt?: Date;
  // 'host': added by the host; 'public': answered through the public link;
  // 'desk': not on the list, added at the reception desk on the day;
  // 'ledger': not on the list, added by the host to record their gift
  source: string;
  rsvp?: Rsvp;
  sentAt?: Date;
  remindedAt?: Date;
  thankedAt?: Date;
  group?: string;
  arrivedAt?: Date;
  arrivedCount?: number;
  table?: string;
  gift?: ReceivedGift;
}

const RsvpSchema = new Schema({
  status: { type: String, enum: RSVP_STATUSES, required: true },
  count: { type: Number, default: 1 },
  note: { type: String, default: '' },
  respondedAt: { type: Date },
}, { _id: false });

const ReceivedGiftSchema = new Schema({
  // VND; none for a gift that is not money ("1 chỉ vàng")
  amount: { type: Number },
  note: { type: String },
  at: { type: Date, required: true },
}, { _id: false });

export const GuestSchema = new Schema({
  name: { type: String, require: true },
  mail: { type: String },
  viewed: { type: Number, require: true, default: 0 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', require: true },
  isDeleted: { type: Boolean, default: false },
  // Set when the guest or their event is deleted: removed for good later
  deletedAt: { type: Date },
  source: { type: String, enum: ['host', 'public', 'desk', 'ledger'], default: 'host' },
  rsvp: { type: RsvpSchema, default: undefined },
  // When the host marked their personal link as sent (Zalo, Messenger...)
  sentAt: { type: Date },
  // When the host last sent them a reminder to answer
  remindedAt: { type: Date },
  // When the host sent them a thank-you after the party
  thankedAt: { type: Date },
  // Set by the host: "Nhà trai", "Nhà gái", "Bạn bè"...
  group: { type: String },
  // Checked in at the reception desk, with how many people came (them included)
  arrivedAt: { type: Date },
  arrivedCount: { type: Number },
  // Where they sit at the party ("12", "VIP"), set by the host
  table: { type: String },
  // The host's gift ledger; only the host ever sees it
  gift: { type: ReceivedGiftSchema, default: undefined },
}, { timestamps: true });

// The host's list and every count of an event's guests
GuestSchema.index({ event: 1 });
GuestSchema.index({ deletedAt: 1 }, { expireAfterSeconds: PURGE_AFTER_SECONDS });

export type GuestDocument = Guest & Document;
