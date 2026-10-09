// src/services/emailTemplates.ts
export const emailTemplates = {
  emailVerification: (name: string, verificationUrl: string) => ({
    subject: "Verify Your Email - Trainer Marketplace",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #2563eb; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0; 
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Trainer Marketplace!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Thanks for signing up! Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Trainer Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${name},
      
      Thanks for signing up for Trainer Marketplace!
      
      Please verify your email address by clicking this link:
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, please ignore this email.
      
      © 2024 Trainer Marketplace
    `,
  }),

  emailVerificationSuccess: (name: string) => ({
    subject: "Email Verified Successfully - Trainer Marketplace",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2>Email Verified Successfully! 🎉</h2>
        <p>Hi ${name},</p>
        <p>Your email address has been successfully verified. You can now enjoy full access to Trainer Marketplace!</p>
        <p>Start exploring trainers or set up your trainer profile today.</p>
        <p>Best regards,<br>The Trainer Marketplace Team</p>
      </div>
    `,
    text: `Hi ${name}, Your email has been verified successfully! Welcome to Trainer Marketplace.`,
  }),

  passwordReset: (name: string, resetUrl: string) => ({
    subject: "Reset Your Password - Trainer Marketplace",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to set a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
            <p><strong>This link will expire in 15 minutes.</strong></p>
            <p>If you did not request this, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Trainer Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${name},

      We received a request to reset your password.

      Reset your password here:
      ${resetUrl}

      This link expires in 15 minutes.

      If you did not request this, you can ignore this email.
    `,
  }),

  passwordResetSuccess: (name: string) => ({
    subject: "Password Reset Successful - Trainer Marketplace",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2>Password Updated Successfully</h2>
        <p>Hi ${name},</p>
        <p>Your password was changed successfully.</p>
        <p>If you did not perform this action, please contact support immediately.</p>
        <p>Best regards,<br>The Trainer Marketplace Team</p>
      </div>
    `,
    text: `Hi ${name}, your password was changed successfully. If this was not you, contact support immediately.`,
  }),

  /** Internal alert to the Salvio team, not sent to the trainer. */
  trainerContactAlert: (alert: TrainerContactAlertDetails) => {
    const esc = (value: string): string =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const channels = Object.entries(alert.channelCounts)
      .map(([channel, count]) => `${channel}: ${count}`)
      .join(", ");
    const lines: Array<[string, string]> = [
      ["Antrenor", alert.trainerName],
      ["Email", alert.trainerEmail],
      ["Persoane diferite care l-au contactat", String(alert.distinctContacts)],
      ["Apăsări pe canale", channels || "-"],
      ["Abonament", alert.subscriptionSummary],
      ["Profil public", alert.profileUrl ?? "-"],
      ["ID antrenor", String(alert.trainerId)],
    ];

    return {
      subject: `Salvio: ${alert.trainerName} a fost contactat de ${alert.distinctContacts} persoane`,
      html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2>Antrenor gata de conversie</h2>
        <p>${esc(alert.trainerName)} a fost contactat prin aplicație de ${alert.distinctContacts} persoane diferite.</p>
        <table style="border-collapse: collapse;">
          ${lines
            .map(
              ([label, value]) =>
                `<tr><td style="padding: 4px 12px 4px 0; color: #555;">${esc(label)}</td><td style="padding: 4px 0;"><strong>${esc(value)}</strong></td></tr>`
            )
            .join("\n          ")}
        </table>
      </div>
    `,
      text: lines.map(([label, value]) => `${label}: ${value}`).join("\n"),
    };
  },
};

export interface TrainerContactAlertDetails {
  trainerId: number;
  trainerName: string;
  trainerEmail: string;
  distinctContacts: number;
  channelCounts: Record<string, number>;
  subscriptionSummary: string;
  profileUrl: string | null;
}
