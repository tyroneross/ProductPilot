import * as jose from 'jose';
import type { RequestHandler } from 'express';

const NEON_AUTH_URL = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL;

const JWKS = NEON_AUTH_URL
  ? jose.createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))
  : null;

/**
 * Permissive auth — extracts user ID from JWT if present.
 * Does NOT block unauthenticated requests (demo users allowed).
 */
export const extractUser: RequestHandler = async (req: any, _res, next) => {
  req.userId = null;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !JWKS) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: NEON_AUTH_URL ? new URL(NEON_AUTH_URL).origin : undefined,
    });
    req.userId = payload.sub || null;
  } catch {
    // Invalid token — treat as unauthenticated
  }

  next();
};

/**
 * Strict auth — blocks unauthenticated requests with 401.
 */
export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};
