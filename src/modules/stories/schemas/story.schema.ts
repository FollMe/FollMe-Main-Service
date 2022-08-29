import mongoose from 'mongoose';

const { Schema } = mongoose;

export class Story  {
    name: string;
    picture: { link: string, public_id: string };
    author:  string;
    type: string;
    isDeleted: Boolean;
}

export const StorySchema = new Schema({
    name: String,
    picture: { link: String, public_id: String },
    author:  { type: Schema.Types.ObjectId, ref: 'User' },
    type: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export type StoryDocument = Story & Document;
