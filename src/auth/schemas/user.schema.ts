import mongoose from 'mongoose';

const { Schema } = mongoose;

export class User  {
    fbId: string;
    name: string; 
    email: string;
    slEmail: string;
    password: string; 
    bio: string;
    block: boolean;
    avatar: object;
    info: Array<object>;
    slug: string;
}

export const UserSchema = new Schema({
    fbId: String,
    name: String, 
    email: String,
    slEmail: String,
    password: String, 
    bio: String,
    block: { type: Boolean, default: false },
    avatar: { link: String, public_id: String },
    info: [{ type: String, link: String }],
    slug: { type: String, slug: "slEmail", unique: true }
}, { timestamps: true });

export type UserDocument = User & Document;
