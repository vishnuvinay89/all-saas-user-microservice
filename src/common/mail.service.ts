import nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { json } from 'stream/consumers';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
    const mail=await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
  }
}
