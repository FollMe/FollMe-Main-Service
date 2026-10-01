import { Schema } from 'mongoose';

export class Blog {
    title: string;
    thumbnail: { link: string, public_id: string };
    content: string;
    author: string;
    slug: string;
    viewed: number;
    isDeleted: Boolean;
}

export const BlogSchema = new Schema({
    title: { type: String, require: true },
    thumbnail: { link: String, public_id: String },
    content: { type: String, require: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    // Permanent: comments, reactions and shared links are keyed by the slug,
    // so renaming a blog must not change it.
    slug: { type: String, slug: "title", unique: true, require: true, permanent: true },
    viewed: { type: Number, require: true, default: 0 },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
});

export type BlogDocument = Blog & Document;
