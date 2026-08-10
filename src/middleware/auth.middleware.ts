import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../config/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is missing');
    }
    const token = header.split(' ')[1];

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (user.status === 'SUSPENDED') throw ApiError.forbidden('Your account has been suspended');

    req.user = { userId: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Attaches req.user if a valid token is present, but never rejects the
 * request. Useful for public routes whose response can be personalized.
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user && user.status === 'ACTIVE') {
        req.user = { userId: user.id, role: user.role };
      }
    }
  } catch {
    // ignore invalid token for optional auth
  }
  next();
};
