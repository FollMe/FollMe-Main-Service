import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // create reusable transporter object using the default SMTP transport
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL,
        pass: process.env.GMAIL_APP_PASS,
      },
      port: 465,
      host: 'smtp.gmail.com'
    });
  }
  async sendMail(options) {
    // send mail with defined transport object
    await this.transporter.sendMail(options);
  }

  /**
   * Sends without making the caller wait. A failure is logged, never thrown:
   * an unhandled rejection would take the whole process down.
   */
  sendInBackground(options): void {
    this.sendMail(options).catch(err => {
      this.logger.error(`Sending mail to ${options?.to} failed: ${err?.message ?? err}`);
    });
  }
}
