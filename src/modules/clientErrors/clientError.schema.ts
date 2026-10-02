import { Schema } from 'mongoose';

/** A JavaScript error a visitor's browser ran into, for the team to fix. */
export class ClientError {
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
}

// Kept 30 days, like the purge of deleted data
export const CLIENT_ERROR_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export const ClientErrorSchema = new Schema({
  message: { type: String, required: true },
  stack: { type: String },
  // Path only: no query or hash
  path: { type: String },
  userAgent: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

ClientErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: CLIENT_ERROR_RETENTION_SECONDS });

export type ClientErrorDocument = ClientError & Document;
