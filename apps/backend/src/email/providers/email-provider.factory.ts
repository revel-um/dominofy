import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

import {
  EmailConnection,
  GmailConnection,
  SendEmailBody,
  SmtpConnection,
} from '../email.types';

type GmailDeps = {
  refreshAccessToken: (
    vaultId: string,
    conn: GmailConnection,
  ) => Promise<{ client: OAuth2Client; accessToken: string }>;
  buildRawEmail: (opts: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
  }) => string;
};

type SendEmailInput = {
  vaultId: string;
  conn: EmailConnection;
  to: string;
  subject: string;
  body: SendEmailBody;
};

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<{ messageId?: string }>;
}

class GmailEmailProvider implements EmailProvider {
  constructor(private readonly deps: GmailDeps) {}

  async sendEmail({ vaultId, conn, to, subject, body }: SendEmailInput) {
    const gmailConn = conn as GmailConnection;
    const { client } = await this.deps.refreshAccessToken(vaultId, gmailConn);
    const gmail = google.gmail({ version: 'v1', auth: client });
    const from = body.from || gmailConn.email;
    const raw = this.deps.buildRawEmail({
      from,
      to,
      subject,
      text: body.text,
      html: body.html,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
    });
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return { messageId: res.data.id ?? undefined };
  }
}

class SmtpEmailProvider implements EmailProvider {
  async sendEmail({ conn, to, subject, body }: SendEmailInput) {
    const smtpConn = conn as SmtpConnection;
    const transporter = nodemailer.createTransport({
      host: smtpConn.smtpHost,
      port: smtpConn.smtpPort,
      secure: smtpConn.secure ?? smtpConn.smtpPort === 465,
      auth: {
        user: smtpConn.smtpUser,
        pass: smtpConn.smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: body.from || smtpConn.fromEmail,
      to,
      subject,
      text: body.text,
      html: body.html,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
    });

    return { messageId: info.messageId };
  }
}

export class EmailProviderFactory {
  constructor(private readonly gmailDeps: GmailDeps) {}

  create(conn: EmailConnection): EmailProvider {
    if ((conn as GmailConnection).provider === 'gmail') {
      return new GmailEmailProvider(this.gmailDeps);
    }
    return new SmtpEmailProvider();
  }
}
