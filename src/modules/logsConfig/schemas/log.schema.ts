import mongoose from 'mongoose';

const { Schema } = mongoose;

export class Log {
  location: string;
  slEmail: string;
  responseCode: number;
  userAgent: string;
  browser: string;
}

export const LogSchema = new Schema({
  location: String,
  slEmail: String,
  responseCode: Number,
  userAgent: String,
  browser: String,
}, { timestamps: true });

export type LogDocument = Log & Document;
