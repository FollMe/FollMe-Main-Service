import { Schema } from 'mongoose';

export class Guest {
  name: string;
  mail: string;
  viewed: number;
  event: string;
  isDelete: boolean;
}

export const GuestSchema = new Schema({
  name: { type: String, require: true },
  mail: { type: String },
  viewed: { type: Number, require: true, default: 0 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', require: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export type GuestDocument = Guest & Document;
