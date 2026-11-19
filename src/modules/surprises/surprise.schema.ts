import { Schema } from 'mongoose';

export const MASCOTS = ['bear', 'bunny', 'cat'];
export const MIN_GIFTS = 2;
export const MAX_GIFTS = 6;
export const MAX_NAME = 40;
export const MAX_MESSAGE = 1500;
export const MAX_HINT = 120;
export const MIN_PASSWORD = 3;
export const MAX_PASSWORD = 60;
export const MAX_GIFT_TITLE = 60;
export const MAX_GIFT_NOTE = 200;
export const MAX_GIFT_EMOJI = 8;
export const MAX_PICK_NOTE = 200;
// Wrong passwords before a short wait (a friend guessing, not the birthday girl)
export const MAX_FAILED = 10;
export const FAILED_WINDOW_MS = 10 * 60 * 1000;

/** A gift to choose from. */
export class SurpriseGift {
  _id?: unknown;
  title: string;
  note?: string;
  emoji?: string;
}

/** What they picked, kept as it was even if the gift is edited later. */
export class SurprisePick {
  gift: unknown;
  title: string;
  emoji?: string;
  note?: string;
  at: Date;
}

/**
 * A birthday surprise ("Hộp quà bí mật"): someone opens it with a password
 * only they would know, reads a letter and picks one of the gifts; the
 * owner sees (and is emailed) what they picked.
 */
export class Surprise {
  owner: unknown;
  ownerEmail?: string;
  recipientName: string;
  fromName?: string;
  message: string;
  hint?: string;
  passwordHash: string;
  passwordSalt: string;
  mascot: string;
  opensAt?: Date;
  gifts: SurpriseGift[];
  pick?: SurprisePick;
  failedCount?: number;
  failedAt?: Date;
  isDeleted?: boolean;
}

const GiftSchema = new Schema({
  title: { type: String, required: true },
  note: { type: String },
  emoji: { type: String },
});

const PickSchema = new Schema(
  {
    gift: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    emoji: { type: String },
    note: { type: String },
    at: { type: Date, required: true },
  },
  { _id: false },
);

export const SurpriseSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Where to tell them a gift was picked
    ownerEmail: { type: String },
    recipientName: { type: String, required: true },
    // How the letter is signed ("Anh Tuấn")
    fromName: { type: String },
    message: { type: String, default: '' },
    // Shown before the password, to help: "Ngày mình quen nhau (ddmmyyyy)"
    hint: { type: String },
    // scrypt of the password as written loosely (no case, accents or spaces)
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
    mascot: { type: String, enum: MASCOTS, default: 'bear' },
    // Before then it stays shut ("chưa tới ngày")
    opensAt: { type: Date },
    gifts: { type: [GiftSchema], default: [] },
    pick: { type: PickSchema, default: undefined },
    failedCount: { type: Number, select: false },
    failedAt: { type: Date, select: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SurpriseSchema.index({ owner: 1, createdAt: -1 });

export type SurpriseDocument = Surprise & Document;
