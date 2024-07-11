import mongoose from 'mongoose';

const { Schema } = mongoose;

export class Log {
  location: string;
  slEmail: string;
  responseCode: number;
  clientIP: string;
  platform: string;
  browser: string;
  isMobile: boolean;
  userAgent: string;
  ipList: string;
}

export const LogSchema = new Schema({
  location: String,
  slEmail: String,
  responseCode: Number,
  clientIP: String,
  platform: String,
  browser: String,
  isMobile: Boolean,
  userAgent: String,
  ipList: String,
}, { timestamps: true });

export type LogDocument = Log & Document;
