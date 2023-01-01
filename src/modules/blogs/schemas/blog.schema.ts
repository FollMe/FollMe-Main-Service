import { Schema } from 'mongoose';

export class Blog {
    title: string;
    thumbnail: { link: string, public_id: string };
    content: string;
    author: string;
    slug: string;
    isDeleted: Boolean;
}

export const BlogSchema = new Schema({
    title: { type: String, require: true },
    thumbnail: { link: String, public_id: String },
    content: { type: String, require: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    slug: { type: String, slug: "title", unique: true, require: true },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
});

export type BlogDocument = Blog & Document;
