import nodemailer from "nodemailer";

// Explicit Gmail host on 587 + STARTTLS rather than `service: "gmail"`, which
// uses port 465: Hetzner blocks outbound 25 and 465 on cloud servers, and
// every send from the VPS timed out on connect.
// `||`, not `??`: an empty SMTP_HOST= / SMTP_PORT= line in .env means "default".
const smtpPort = Number(process.env.SMTP_PORT || 587);

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  // 465 is TLS from the first byte; anything else upgrades with STARTTLS.
  secure: smtpPort === 465,
  requireTLS: smtpPort !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Fail fast instead of hanging if Gmail's SMTP is slow/unreachable.
  connectionTimeout: 10_000, // max time to establish the TCP connection
  greetingTimeout: 10_000, // max time to wait for the SMTP greeting
  socketTimeout: 20_000, // max idle time on the socket
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
