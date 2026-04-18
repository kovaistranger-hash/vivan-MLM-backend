import type { Request, Response } from "express";
import { ApiError } from '../../utils/ApiError.js';
import { loginSchema, registerSchema as authSchemaRegister } from './auth.schemas.js';
import { findUserById } from './auth.service.js';
import { loginUserLegacy, registerUser as registerSessionUser, revokeRefreshToken } from './auth.legacy.service.js';
import { getClientIp } from '../../utils/clientIp.js';

export async function register(req: Request, res: Response) {
  try {
    const parsed = authSchemaRegister.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const result = await registerSessionUser({
      ...parsed.data,
      signupIp: getClientIp(req)
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      ...result
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.statusCode : 400;
    return res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : "Registration failed"
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const result = await loginUserLegacy(parsed.data);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...result
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.statusCode : 401;
    return res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed"
    });
  }
}

export async function me(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: !!user.is_active,
        created_at: user.created_at
      }
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile"
    });
  }
}

export async function logout(_req: Request, res: Response) {
  const refreshToken = String(_req.body?.refreshToken || '');
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  return res.status(200).json({
    success: true,
    message: "Logout successful"
  });
}
