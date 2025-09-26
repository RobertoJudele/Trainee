import { Request, Response } from "express";
import { User } from "../models/user";
import { sendError, sendSuccess } from "../utils/response";
import { emailService } from "../services/emailService";
import { AuthenticatedRequest } from "src/types/common";

interface VerifyEmailRequest {
  token: string;
  email: string;
}

interface ResendVerificationRequest {
  email: string;
}

export const verifyEmail = async (
  req: Request<{}, {}, {}, VerifyEmailRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email, token } = req.query;
    if (!token || !email) {
      sendError(res, 400, "Token and email invalid");
      return;
    }
    const user = await User.findOne({ where: { email: email } });
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }
    if (user.emailVerifiedAt) {
      sendError(res, 400, "Email is already verified");
      return;
    }

    const isValid = await user.verfiyEmailToken(token as string);
    await user.save();
    // console.log(token);

    if (!isValid) {
      sendError(res, 400, "Invalid or expired token");
      return;
    }

    try {
      await emailService.sendVerificationSuccessEmail(
        email,
        `${user.firstName} ${user.lastName}`
      );
    } catch (error) {
      console.error("Failed to send success email:", error);
    }

    sendSuccess(res, 200, "Email verified succesfully");
  } catch (error) {
    console.error("Email verification error", error);
    sendError(res, 500, "Email verification failed");
  }
};

export const resendVerifyEmail = async (
  req: Request<{}, {}, ResendVerificationRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email: email } });
    if (!user) {
      sendSuccess(
        res,
        200,
        "If an account with this email exists, a verification email has been sent"
      );
    }

    const token = user!.generateEmailVerificationToken();
    await user?.save();

    await emailService.resendVerificationEmail(
      email,
      `${user?.firstName} ${user?.lastName}`,
      token
    );
    sendSuccess(res, 200, "Verification email sent successfully");
  } catch (error) {
    console.error("Resend verification error: ", error);
    sendError(res, 500, "Resending failed");
  }
};

export const checkVerificationStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    sendSuccess(res, 200, "Verification status retrieved", {
      isVerified: !!user.emailVerifiedAt,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
    });
  } catch (error) {
    console.error("Failed retrieving verify status", error);
  }
};
