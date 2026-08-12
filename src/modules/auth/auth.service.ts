import bcrypt from "bcryptjs";

import { prisma } from "../../config/prisma";
import { googleClient } from "../../config/google";
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
  // =====================================================
  // REGISTER
  // =====================================================

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

  // =====================================================
  // NORMAL LOGIN
  // =====================================================

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

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  async googleLogin(idToken: string) {
    if (!idToken) {
      throw ApiError.unauthorized("Google ID token is required");
    }

    // ---------------------------------------------------
    // Verify Google ID Token
    // ---------------------------------------------------
    console.time("google-total");

    console.time("google-verify");
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    console.timeEnd("google-verify");
    const payload = ticket.getPayload();

    if (!payload) {
      throw ApiError.unauthorized("Invalid Google authentication");
    }

    const { sub, email, name, picture, email_verified } = payload;
    console.time("db-google");
    if (!sub || !email) {
      throw ApiError.unauthorized("Google account information is incomplete");
    }

    if (!email_verified) {
      throw ApiError.unauthorized("Google email is not verified");
    }

    // ---------------------------------------------------
    // 1. Find user by Google ID
    // ---------------------------------------------------

    let user = await prisma.user.findUnique({
      where: {
        googleId: sub,
      },
    });

    // ---------------------------------------------------
    // 2. If Google ID not found, find by email
    // ---------------------------------------------------
    console.timeEnd("db-google");

    console.time("db-email");
    if (!user) {
      user = await prisma.user.findUnique({
        where: {
          email,
        },
      });
    }
    console.timeEnd("db-email");
    // ---------------------------------------------------
    // 3. Existing User
    // ---------------------------------------------------

    if (user) {
      if (user.status === "SUSPENDED") {
        throw ApiError.forbidden(
          "Your account has been suspended. Contact support.",
        );
      }

      /*
       * Update Google information.
       *
       * IMPORTANT:
       * name comes directly from Google account.
       */

      user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          googleId: user.googleId || sub,
          name: name?.trim() || user.name,
          avatar: picture ?? user.avatar,
        },
      });
    }

    // ---------------------------------------------------
    // 4. New Google User
    // ---------------------------------------------------

    if (!user) {
      /*
       * Your Prisma schema currently requires password.
       *
       * Google users don't need to know this password.
       * We generate a random hashed password internally.
       */

      const randomPassword = await bcrypt.hash(
        `${sub}-${Date.now()}-${Math.random()}`,
        SALT_ROUNDS,
      );

      user = await prisma.user.create({
        data: {
          // Google account name
          name: name?.trim() || email.split("@")[0],

          email,

          password: randomPassword,

          // Google unique ID
          googleId: sub,

          // Google profile picture
          avatar: picture ?? null,

          // Google users are customers by default
          role: "CUSTOMER",

          status: "ACTIVE",
        },
      });
    }

    // ---------------------------------------------------
    // 5. Create Application JWTs
    // ---------------------------------------------------

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

  // =====================================================
  // REFRESH TOKEN
  // =====================================================

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

  // =====================================================
  // CURRENT USER
  // =====================================================

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
