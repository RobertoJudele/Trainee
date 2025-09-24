import { Request, Response } from "express";
import { send } from "process";
import { User } from "../models/user";
import { AuthResponse, RegisterRequest } from "../types/user";
import { generateToken } from "../utils/jwt";
import { sendError, sendSuccess } from "../utils/response";
import { where } from "sequelize";
import { AuthenticatedRequest } from "../types/common";
import { emailService } from "../services/emailService";

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

    const authResponse: AuthResponse = { user: user.toJSON(), token };

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

    const authResponse: AuthResponse = {
      user: user.toJSON(),
      token,
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
