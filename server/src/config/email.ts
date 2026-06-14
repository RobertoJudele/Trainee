import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  // Use STARTTLS on 587 explicitly. The `service: "gmail"` shortcut defaults to
  // port 465 (SSL), which is blocked on the VPS even though 587 is reachable.
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // upgrade to TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Fail fast instead of hanging for minutes when SMTP is unreachable
  // (e.g. outbound port blocked on the VPS).
  connectionTimeout: 10_000, // 10s to establish the TCP connection
  greetingTimeout: 10_000, // 10s to receive the SMTP greeting
  socketTimeout: 15_000, // 15s of socket inactivity
});

// Test connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log("✅ Email service is ready");
    return true;
  } catch (error) {
    console.error("❌ Email service error:", error);
    return false;
  }
};
