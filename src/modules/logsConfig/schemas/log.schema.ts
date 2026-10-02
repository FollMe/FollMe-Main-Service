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

// Access logs (with IPs) are kept 90 days, then MongoDB drops them.
export const LOG_RETENTION_SECONDS = 90 * 24 * 60 * 60;
LogSchema.index({ createdAt: 1 }, { expireAfterSeconds: LOG_RETENTION_SECONDS });

export type LogDocument = Log & Document;
