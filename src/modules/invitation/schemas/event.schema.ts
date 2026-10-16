import { Schema } from 'mongoose';
import {
  EVENT_MUSIC, EVENT_THEMES, EVENT_TYPES, EXPENSE_CATEGORIES, EXPENSE_PAYERS, GIFT_SIDES, PURGE_AFTER_SECONDS, TASK_LINKS,
} from '../invitation.constants';

export class Event {
  title: string;
  location: string;
  mapLocation: string;
  startAt: Date;
  host: string;
  cohosts?: string[];
  cohostKey?: string;
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
  seatsPerTable?: number;
  rsvpBy?: Date;
  gifts?: Gift[];
  program?: ProgramItem[];
  story?: StoryItem[];
  budget?: number;
  expenses?: Expense[];
  checklist?: Task[];
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

/** A moment of the day: "18:00", "Khai tiệc" (Vietnam time, on the event's day). */
export class ProgramItem {
  time: string;
  label: string;
}

export class StoryItem {
  when?: string;
  title: string;
  text?: string;
}

/** A line of the host's budget (VND). */
export class Expense {
  _id?: unknown;
  label: string;
  category: string;
  amount?: number;
  paid?: number;
  note?: string;
  payer?: string;
}

/** A thing to do for the event, from the host's checklist. */
export class Task {
  _id?: unknown;
  label: string;
  due?: Date;
  done?: boolean;
  doneAt?: Date;
  link?: string;
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

const ProgramItemSchema = new Schema({
  time: { type: String, required: true },
  label: { type: String, required: true },
}, { _id: false });

// A moment of the couple's story ("Mùa thu 2019", "Lần đầu gặp nhau", a few lines)
const StoryItemSchema = new Schema({
  when: { type: String },
  title: { type: String, required: true },
  text: { type: String },
}, { _id: false });

const ExpenseSchema = new Schema({
  label: { type: String, required: true },
  category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
  // The full cost and how much of it is paid so far; unset when not known yet
  amount: { type: Number },
  paid: { type: Number },
  note: { type: String },
  // 'groom', 'bride' or 'shared' (half each); unset when the couple pays
  payer: { type: String, enum: EXPENSE_PAYERS },
}, { timestamps: true });

const TaskSchema = new Schema({
  label: { type: String, required: true },
  due: { type: Date },
  done: { type: Boolean, default: false },
  doneAt: { type: Date },
  // The tool that does it ('seating', 'send'...), shown as a shortcut
  link: { type: String, enum: TASK_LINKS },
});

const PhotoSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  width: { type: Number },
  height: { type: Number },
});

// A photo a guest took at the party: who sent it, and whether the host hid it
const GuestPhotoSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  width: { type: Number },
  height: { type: Number },
  guest: { type: Schema.Types.ObjectId, ref: 'Guest', required: true },
  name: { type: String },
  hidden: { type: Boolean },
  at: { type: Date, required: true },
});

export const EventSchema = new Schema({
  title: { type: String, require: true },
  location: { type: String, require: true },
  mapLocation: { type: String },
  startAt: { type: Date },
  host: { type: Schema.Types.ObjectId, ref: 'User' },
  // Users who manage it with the host (everything but deleting it and
  // choosing who else manages it); they join through a link from the host
  cohosts: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: undefined },
  // Secret part of that link. Never sent to guests or co-hosts.
  cohostKey: { type: String, select: false },
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
  // Seats at each table, for the seating plan (unset: the page's default)
  seatsPerTable: { type: Number },
  // Guests are asked to answer by then (the end of that day in Vietnam);
  // answers stay open after it
  rsvpBy: { type: Date },
  gifts: { type: [GiftSchema], default: undefined },
  // In time order; unset when the host gave none
  program: { type: [ProgramItemSchema], default: undefined },
  story: { type: [StoryItemSchema], default: undefined },
  // The host's budget (thu chi): a planned total and each expense. Only the
  // host's own view of the event asks for the expenses.
  budget: { type: Number },
  expenses: { type: [ExpenseSchema], default: undefined, select: false },
  // The host's checklist (việc cần làm); only their own view asks for it
  checklist: { type: [TaskSchema], default: undefined, select: false },
  photos: { type: [PhotoSchema], default: undefined },
  // Guests' photos from the party; read only by the views that show them
  guestPhotos: { type: [GuestPhotoSchema], default: undefined, select: false },
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
EventSchema.index({ cohosts: 1 });
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
