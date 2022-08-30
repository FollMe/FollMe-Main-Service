import { Schema } from 'mongoose';

export class Story  {
    name: string;
    picture: { link: string, public_id: string };
    author:  string;
    type: string;
    slug: string;
    chaps: any;
    isDeleted: Boolean;
}

export const StorySchema = new Schema({
    name: { type: String, require: true },
    picture: { link: String, public_id: String },
    author:  { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, require: true },
    slug: { type: String, slug: "name", unique: true, require: true },
    isDeleted: { type: Boolean, default: false }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

StorySchema.virtual('chaps', {
    ref: 'Chap',
    localField: '_id',
    foreignField: 'story',
    match: { isDeleted: { $ne: true } }
  });

export type StoryDocument = Story & Document;
