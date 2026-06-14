import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
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
