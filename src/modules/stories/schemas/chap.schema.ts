import { Schema } from 'mongoose';

export class Chap  {
    name: string;
    story: string;
    slug: string;
    content: string;
    isDeleted: boolean;
}

export const ChapSchema = new Schema({
    name: { type: String, require: true },
    story:  { type: Schema.Types.ObjectId, ref: 'Story', require: true },
    slug: { type: String, slug: "name", require: true },
    content: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export type ChapDocument = Chap & Document;
