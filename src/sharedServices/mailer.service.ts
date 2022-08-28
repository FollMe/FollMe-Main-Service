import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({
            host: "smtp.sendgrid.net",
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: 'apikey', // generated ethereal user
                pass: process.env.SEND_GRID_API_KEY, // generated ethereal password
            },
        });
    }
    async sendMail(options) {
        // send mail with defined transport object
        await this.transporter.sendMail(options);
    }
}
