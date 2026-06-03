import { Request, Response } from "express";
import { User } from "../models/user";
import { RefreshToken } from "../models/refreshToken";
import { AuthResponse, RegisterRequest } from "../types/user";
import {
  generatePasswordResetToken,
  generateToken,
  generateRefreshToken,
  verifyPasswordResetToken,
} from "../utils/jwt";
import { sendError, sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../types/common";
import { emailService } from "../services/emailService";

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const register = async (
  req: Request<{}, {}, RegisterRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      sendError(res, 409, "User with this email already exists");
      return;
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
    });

    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({
      token: rawRefreshToken,
      userId: user.id,
      expiresAt,
    });

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    try {
      await emailService.sendVerificationEmail(
        email,
        `${firstName} ${lastName}`,
        verificationToken
      );
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    const authResponse: AuthResponse = { 
      user: user.toJSON(), 
      token,
      refreshToken: rawRefreshToken
    };

    sendSuccess(res, 201, "User registered succesfully", authResponse);
  } catch (error: any) {
    console.log(error);
    if (error.name == "SequelizeValidationError") {
      const errors = error.errors.map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      sendError(res, 400, "Validation failed", error);
      return;
    }
    sendError(res, 500, "Registrations failed. Please try again");
  }
};

export const login = async (
  req: Request<{}, {}, RegisterRequest>,
  res: Response
) => {
  try {
    const { email, password } = req.body;
    const user = await User.scope("withPassword").findOne({
      where: { email, isActive: true },
    });
    if (!user) {
      sendError(res, 401, "Wrong credentials");
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      sendError(res, 401, "Wrong credentials");
      return;
    }

    await user.update({ lastLoginAt: new Date() });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({
      token: rawRefreshToken,
      userId: user.id,
      expiresAt,
    });

    const authResponse: AuthResponse = {
      user: user.toJSON(),
      token,
      refreshToken: rawRefreshToken,
    };

    sendSuccess(res, 201, "User logged in succesfully", authResponse);
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, 500, "Login failed. Please try again.");
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    res.json(user);
    // sendSuccess(res, 200, "Profile retrieved succesfully!");
  } catch (error) {
    console.error("Get profile error", error);
    sendError(res, 500, "Couldnt retrieve profile");
  }
};

export const forgotPassword = async (
  req: Request<{}, {}, ForgotPasswordRequest>,
  res: Response
) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      sendError(res, 400, "Email is required");
      return;
    }

    const user = await User.findOne({ where: { email: normalizedEmail, isActive: true } });

    if (user) {
      const token = generatePasswordResetToken({
        userId: user.id,
        email: user.email,
        purpose: "password_reset",
      });

      try {
        await emailService.sendPasswordResetEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
          token
        );
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    }

    // Always return the same message to prevent email enumeration.
    sendSuccess(
      res,
      200,
      "If an account with that email exists, we have sent a password reset link."
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    sendError(res, 500, "Could not process forgot password request");
  }
};

export const resetPassword = async (
  req: Request<{}, {}, ResetPasswordRequest>,
  res: Response
) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      sendError(res, 400, "Token and new password are required");
      return;
    }

    let payload;
    try {
      payload = verifyPasswordResetToken(token);
    } catch {
      sendError(res, 400, "Invalid or expired reset token");
      return;
    }

    if (payload.purpose !== "password_reset") {
      sendError(res, 400, "Invalid reset token");
      return;
    }

    const user = await User.scope("withPassword").findOne({
      where: { id: payload.userId, email: payload.email, isActive: true },
    });

    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    user.password = newPassword;
    await user.save();

    try {
      await emailService.sendPasswordResetSuccessEmail(
        user.email,
        `${user.firstName} ${user.lastName}`
      );
    } catch (emailError) {
      console.error("Failed to send password reset success email:", emailError);
    }

    sendSuccess(res, 200, "Password reset successful");
  } catch (error) {
    console.error("Reset password error:", error);
    sendError(res, 500, "Could not reset password");
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: clientToken } = req.body;

    if (!clientToken) {
      sendError(res, 400, "Refresh token is required");
      return;
    }

    const storedToken = await RefreshToken.findOne({
      where: { token: clientToken, isRevoked: false },
      include: [User],
    });

    if (!storedToken) {
      sendError(res, 401, "Invalid refresh token");
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      // Mark it as revoked since it is expired
      await storedToken.update({ isRevoked: true });
      sendError(res, 401, "Expired refresh token");
      return;
    }

    const user = storedToken.user;
    if (!user || !user.isActive) {
      sendError(res, 401, "User is inactive or not found");
      return;
    }

    // Generate new tokens
    const newAccessToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRawRefreshToken = generateRefreshToken();
    const nextExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke the old refresh token
    await storedToken.update({ isRevoked: true });

    // Create the new rotated refresh token
    await RefreshToken.create({
      token: newRawRefreshToken,
      userId: user.id,
      expiresAt: nextExpiry,
    });

    sendSuccess(res, 200, "Token refreshed successfully", {
      token: newAccessToken,
      refreshToken: newRawRefreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    sendError(res, 500, "Could not refresh token");
  }
};
