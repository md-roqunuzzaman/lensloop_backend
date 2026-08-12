import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

import { authService } from "./auth.service";

/*
|--------------------------------------------------------------------------
| Cookie configuration
|--------------------------------------------------------------------------
*/

const isProduction = process.env.NODE_ENV === "production";

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 60 * 60 * 1000, // 1 hour
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
};

/*
|--------------------------------------------------------------------------
| Controller
|--------------------------------------------------------------------------
*/

export const authController = {
  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  register: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);

    // Access token cookie
    res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);

    // Refresh token cookie
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendResponse(res, StatusCodes.CREATED, "Registration successful", {
      user: result.user,
    });
  }),

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  login: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    // Access token
    res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);

    // Refresh token
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendResponse(res, StatusCodes.OK, "Login successful", {
      user: result.user,
    });
  }),

  google: catchAsync(async (req: Request, res: Response) => {
    const { idToken } = req.body;

    const result = await authService.googleLogin(idToken);

    res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);

    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendResponse(res, StatusCodes.OK, "Google login successful", {
      user: result.user,
    });
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    /*
     * Prefer HttpOnly cookie.
     *
     * Body refreshToken is also supported
     * for Postman/testing.
     */

    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;

    if (!refreshToken) {
      throw ApiError.unauthorized("Refresh token is missing");
    }

    const result = await authService.refresh(refreshToken);

    // New access token
    res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);

    // Rotate refresh token
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendResponse(res, StatusCodes.OK, "Token refreshed", {
      success: true,
    });
  }),

  /*
  |--------------------------------------------------------------------------
  | CURRENT USER
  |--------------------------------------------------------------------------
  */

  me: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const user = await authService.me(req.user.userId);

    sendResponse(res, StatusCodes.OK, "Current user fetched", user);
  }),

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  logout: catchAsync(async (_req: Request, res: Response) => {
    // Clear access token
    res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);

    // Clear refresh token
    res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS);

    sendResponse(res, StatusCodes.OK, "Logout successful", null);
  }),
};
