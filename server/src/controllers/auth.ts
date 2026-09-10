import { Request, Response } from "express";
import { User } from "../models/user";
import { RefreshToken } from "../models/refreshToken";
import { AuthResponse, RegisterRequest } from "../types/user";
import {
  generatePasswordResetToken,
  generateToken,
  generateRefreshToken,
  generateSocialSignupToken,
  verifyPasswordResetToken,
  verifySocialSignupToken,
} from "../utils/jwt";
import { sendError, sendSuccess } from "../utils/response";
import { getSequelizeValidationErrors } from "../utils/errors";
import { AuthenticatedRequest, UserRole } from "../types/common";
import { emailService } from "../services/emailService";
import {
  SocialAuthError,
  verifySocialIdToken,
  type SocialProvider,
} from "../services/socialAuth";

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

interface SocialAuthRequest {
  provider: SocialProvider;
  idToken: string;
  firstName?: string;
  lastName?: string;
}

interface SocialCompleteRequest {
  pendingToken: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Mint an access token and persist a fresh refresh token for a user. */
const issueSession = async (
  user: User
): Promise<{ token: string; refreshToken: string }> => {
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const rawRefreshToken = generateRefreshToken();
  await RefreshToken.create({
    token: rawRefreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { token, refreshToken: rawRefreshToken };
};

const PROVIDER_ID_FIELD = {
  google: "googleId",
  apple: "appleId",
} as const satisfies Record<SocialProvider, "googleId" | "appleId">;

const PROVIDER_LABEL = { google: "Google", apple: "Apple" } as const;

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

    const { token, refreshToken: rawRefreshToken } = await issueSession(user);

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send the verification email without blocking the signup response. Gmail SMTP
    // can be slow or hang, and awaiting it here caused the client/gateway to time out
    // and report "Signup failed" even though the account was already created above.
    void emailService
      .sendVerificationEmail(email, `${firstName} ${lastName}`, verificationToken)
      .catch((emailError) => {
        console.error("Failed to send verification email:", emailError);
      });

    const authResponse: AuthResponse = { 
      user: user.toJSON(), 
      token,
      refreshToken: rawRefreshToken
    };

    sendSuccess(res, 201, "User registered succesfully", authResponse);
  } catch (error: unknown) {
    console.log(error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
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

    // A social-only account has no hash to compare against. Say so plainly —
    // "wrong credentials" would send the user to the password reset flow for a
    // password that never existed.
    if (!user.hasPassword()) {
      sendError(
        res,
        401,
        "This account uses Google or Apple sign-in. Use that button to continue."
      );
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      sendError(res, 401, "Wrong credentials");
      return;
    }

    await user.update({ lastLoginAt: new Date() });

    const { token, refreshToken: rawRefreshToken } = await issueSession(user);

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

/**
 * Step 1 of social sign-in. Verifies the provider's ID token and either logs the
 * user straight in, or - for a brand-new identity - hands back a short-lived
 * pendingToken so the client can collect the phone number Salvio requires and
 * neither Google nor Apple supplies. No user row is written until step 2.
 */
export const socialAuth = async (
  req: Request<{}, {}, SocialAuthRequest>,
  res: Response
): Promise<void> => {
  try {
    const { provider, idToken } = req.body;

    let identity;
    try {
      identity = await verifySocialIdToken(provider, idToken);
    } catch (error) {
      if (error instanceof SocialAuthError) {
        sendError(res, 401, error.message);
        return;
      }
      throw error;
    }

    const idField = PROVIDER_ID_FIELD[provider];

    // Already linked - straight in.
    const linked = await User.findOne({
      where: { [idField]: identity.providerId, isActive: true },
    });
    if (linked) {
      await linked.update({ lastLoginAt: new Date() });
      const session = await issueSession(linked);
      sendSuccess(res, 200, "User logged in succesfully", {
        user: linked.toJSON(),
        ...session,
      } satisfies AuthResponse);
      return;
    }

    // Same verified email as an existing account - link the provider to it.
    // Only when the provider vouches for the address; an unverified claim would
    // let anyone who can mint a token for that email take over the account.
    if (identity.emailVerified) {
      const byEmail = await User.findOne({
        where: { email: identity.email, isActive: true },
      });
      if (byEmail) {
        await byEmail.update({
          [idField]: identity.providerId,
          isVerified: true,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
        });
        const session = await issueSession(byEmail);
        sendSuccess(res, 200, "User logged in succesfully", {
          user: byEmail.toJSON(),
          ...session,
        } satisfies AuthResponse);
        return;
      }
    }

    // Brand new. Apple only ever sends the name on the very first authorization
    // and never inside the token, so fall back to what the client passed up.
    const pendingToken = generateSocialSignupToken({
      provider,
      providerId: identity.providerId,
      email: identity.email,
      firstName: identity.firstName ?? req.body.firstName,
      lastName: identity.lastName ?? req.body.lastName,
      purpose: "social_signup",
    });

    sendSuccess(res, 200, "Additional profile details required", {
      needsProfile: true,
      pendingToken,
      email: identity.email,
      firstName: identity.firstName ?? req.body.firstName ?? "",
      lastName: identity.lastName ?? req.body.lastName ?? "",
    });
  } catch (error) {
    console.error("Social auth error:", error);
    sendError(res, 500, "Sign-in failed. Please try again.");
  }
};

/**
 * Step 2 of social sign-in: create the account now that the phone number and
 * name are known. The provider identity comes from the signed pendingToken, not
 * from the request body, so the client cannot claim someone else's identity.
 */
export const socialAuthComplete = async (
  req: Request<{}, {}, SocialCompleteRequest>,
  res: Response
): Promise<void> => {
  try {
    const { pendingToken, firstName, lastName, phone } = req.body;

    let payload;
    try {
      payload = verifySocialSignupToken(pendingToken);
    } catch {
      sendError(res, 401, "Invalid or expired sign-in session. Please try again.");
      return;
    }

    // An access token is signed with the same secret; only `purpose` separates them.
    if (payload.purpose !== "social_signup") {
      sendError(res, 401, "Invalid sign-in session. Please try again.");
      return;
    }

    const idField = PROVIDER_ID_FIELD[payload.provider];

    // Re-check both uniqueness rules: the token is valid for 15 minutes, during
    // which the same identity or email could have been registered another way.
    const existing = await User.findOne({
      where: { [idField]: payload.providerId },
    });
    if (existing) {
      sendError(
        res,
        409,
        `That ${PROVIDER_LABEL[payload.provider]} account is already linked to a Salvio account.`
      );
      return;
    }

    const emailTaken = await User.findOne({ where: { email: payload.email } });
    if (emailTaken) {
      sendError(res, 409, "User with this email already exists");
      return;
    }

    const user = await User.create({
      email: payload.email,
      firstName,
      lastName,
      phone,
      role: UserRole.CLIENT,
      [idField]: payload.providerId,
      // The provider already proved the address; no verification email needed.
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    const session = await issueSession(user);

    sendSuccess(res, 201, "User registered succesfully", {
      user: user.toJSON(),
      ...session,
    } satisfies AuthResponse);
  } catch (error: unknown) {
    console.error("Social signup completion error:", error);
    const validationErrors = getSequelizeValidationErrors(error);
    if (validationErrors) {
      sendError(res, 400, "Validation failed", validationErrors);
      return;
    }
    sendError(res, 500, "Sign-up failed. Please try again.");
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

      // Fire-and-forget so a slow/hanging Gmail SMTP send can't stall the response.
      void emailService
        .sendPasswordResetEmail(user.email, `${user.firstName} ${user.lastName}`, token)
        .catch((emailError) => {
          console.error("Failed to send password reset email:", emailError);
        });
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

    // Fire-and-forget so a slow/hanging Gmail SMTP send can't stall the response.
    void emailService
      .sendPasswordResetSuccessEmail(user.email, `${user.firstName} ${user.lastName}`)
      .catch((emailError) => {
        console.error("Failed to send password reset success email:", emailError);
      });

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

    // Revoke the old refresh token before minting the rotated pair
    await storedToken.update({ isRevoked: true });

    const { token: newAccessToken, refreshToken: newRawRefreshToken } =
      await issueSession(user);

    sendSuccess(res, 200, "Token refreshed successfully", {
      token: newAccessToken,
      refreshToken: newRawRefreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    sendError(res, 500, "Could not refresh token");
  }
};
