import bcrypt from "bcryptjs";

import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";

import { LoginInput, RegisterInput } from "./auth.validation";

const SALT_ROUNDS = 12;

function toSafeUser<T extends { password: string }>(user: T) {
  const { password, ...safe } = user;

  return safe;
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const hashed = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashed,
        role: input.role,
        phone: input.phone,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      role: user.role,
    });

    return {
      user: toSafeUser(user),
      accessToken,
      refreshToken,
    };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const match = await bcrypt.compare(input.password, user.password);

    if (!match) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.status === "SUSPENDED") {
      throw ApiError.forbidden(
        "Your account has been suspended. Contact support.",
      );
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      role: user.role,
    });

    return {
      user: toSafeUser(user),
      accessToken,
      refreshToken,
    };
  },

  async refresh(refreshToken: string) {
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });

    if (!user || user.status === "SUSPENDED") {
      throw ApiError.unauthorized("User not found or suspended");
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const newRefreshToken = signRefreshToken({
      userId: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return toSafeUser(user);
  },
};
