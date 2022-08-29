import mongoose from 'mongoose';

const { Schema } = mongoose;

export class CertifyCode  {
    email: string;
    code: string;
    expiredTime: Date;
}

export const CertifyCodeSchema = new Schema({
    email: String,
    code: String,
    expiredTime: Date,
}, { timestamps: true });

export type CertifyCodeDocument = CertifyCode & Document;
