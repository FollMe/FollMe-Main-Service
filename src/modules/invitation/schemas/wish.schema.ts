import { Schema } from 'mongoose';
import { PURGE_AFTER_SECONDS } from '../invitation.constants';

/** A message on an event's wishes wall ("sổ lưu bút"). */
export class Wish {
  event: string;
  guest?: string;
  name: string;
  message: string;
  isHidden: boolean;
  deletedAt?: Date;
}

export const WishSchema = new Schema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  guest: { type: Schema.Types.ObjectId, ref: 'Guest' },
  name: { type: String, required: true },
  message: { type: String, required: true },
  // The host can hide a wish; it is kept for them but not shown to guests.
  isHidden: { type: Boolean, default: false },
  // Set when the event is deleted: removed for good later
  deletedAt: { type: Date },
}, { timestamps: true });

WishSchema.index({ deletedAt: 1 }, { expireAfterSeconds: PURGE_AFTER_SECONDS });

export type WishDocument = Wish & Document;
