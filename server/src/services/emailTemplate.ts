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
};
