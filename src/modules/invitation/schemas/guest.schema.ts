import { Schema } from 'mongoose';

export class Guest {
  mail: string;
  viewed: number;
  event: string;
  isDelete: boolean;
}

export const GuestSchema = new Schema({
  mail: { type: String, require: true },
  viewed: { type: Number, require: true, default: 0 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', require: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export type GuestDocument = Guest & Document;
