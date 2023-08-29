import mongoose from 'mongoose';

const { Schema } = mongoose;

export class Log {
  location: string;
  slEmail: string;
  responseCode: number;
}

export const LogSchema = new Schema({
  location: String,
  slEmail: String,
  responseCode: Number,
}, { timestamps: true });

export type LogDocument = Log & Document;
