export type GmailConnection = {
  provider: 'gmail';
  email: string;
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
  historyId?: string; // last processed historyId (cursor)
};

export type SmtpConnection = {
  provider?: 'smtp';
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  secure?: boolean;
  inboundSecret?: string;
};

export type EmailConnection = GmailConnection | SmtpConnection;

export type SendEmailBody = {
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};
