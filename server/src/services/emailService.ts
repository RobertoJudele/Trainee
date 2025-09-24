// src/services/emailService.ts
import { transporter } from "../config/email";
import { emailTemplates } from "./emailTemplate";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private from: string;

  constructor() {
    this.from = process.env.FROM_EMAIL || "noreply@trainee.com";
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`✅ Email sent to ${options.to}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${options.to}:`, error);
      throw new Error("Failed to send email");
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/email/verify?token=${token}&email=${encodeURIComponent(email)}`;
    const template = emailTemplates.emailVerification(name, verificationUrl);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendVerificationSuccessEmail(
    email: string,
    name: string
  ): Promise<void> {
    const template = emailTemplates.emailVerificationSuccess(name);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async resendVerificationEmail(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    await this.sendVerificationEmail(email, name, token);
  }
}

export const emailService = new EmailService();
