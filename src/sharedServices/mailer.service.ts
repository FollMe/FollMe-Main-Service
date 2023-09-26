import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
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
}
