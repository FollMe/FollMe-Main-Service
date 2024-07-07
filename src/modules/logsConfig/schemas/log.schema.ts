import mongoose from 'mongoose';

const { Schema } = mongoose;

export class Log {
  location: string;
  slEmail: string;
  responseCode: number;
  ip: string;
  platform: string;
  browser: string;
  isMobile: boolean;
  userAgent: string;
}

export const LogSchema = new Schema({
  location: String,
  slEmail: String,
  responseCode: Number,
  ip: String,
  platform: String,
  browser: String,
  isMobile: Boolean,
  userAgent: String,
}, { timestamps: true });

export type LogDocument = Log & Document;
