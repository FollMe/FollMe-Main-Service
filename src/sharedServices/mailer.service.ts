import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // create reusable transporter object using the default SMTP transport
        this.transporter = nodemailer.createTransport({
            host: "smtp-relay.sendinblue.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: 'follme.noreply@gmail.com', // generated ethereal user
                pass: process.env.BREVO_MASTER_PASS, // generated ethereal password
            },
        });
    }
    async sendMail(options) {
        // send mail with defined transport object
        await this.transporter.sendMail(options);
    }
}
