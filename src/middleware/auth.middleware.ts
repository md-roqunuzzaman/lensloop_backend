import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { prisma } from "../config/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    // 1. Authorization header
    const header = req.headers.authorization;

    if (header?.startsWith("Bearer ")) {
      token = header.substring(7);
    }

    // 2. HttpOnly accessToken cookie
    if (!token) {
      token = req.cookies?.accessToken;
    }

    // 3. No token
    if (!token) {
      throw ApiError.unauthorized("Authentication token is missing");
    }

    // 4. Verify access token
    let payload: JwtPayload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired token");
    }

    // 5. Check user exists
    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });

    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }

    // 6. Check account status
    if (user.status === "SUSPENDED") {
      throw ApiError.forbidden("Your account has been suspended");
    }

    // 7. Attach user
    req.user = {
      userId: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Attaches req.user if a valid token is present.
 * Never rejects the request.
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    const header = req.headers.authorization;

    if (header?.startsWith("Bearer ")) {
      token = header.substring(7);
    }

    if (!token) {
      token = req.cookies?.accessToken;
    }

    if (token) {
      const payload = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
      });

      if (user && user.status === "ACTIVE") {
        req.user = {
          userId: user.id,
          role: user.role,
        };
      }
    }
  } catch {
    // Optional auth intentionally ignores invalid tokens.
  }

  next();
};
