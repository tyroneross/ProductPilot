import type { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../db";
import { canSendAuthEmail, sendVerificationEmail, sendPasswordResetEmail, sendMagicLinkEmail } from "./email";
import * as authSchema from "./schema";
import { logger } from "../lib/logger";

const authDb = (() => {
  if (!db) {
    throw new Error("Better Auth requires a configured PostgreSQL database.");
  }
  return db;
})();

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required for Better Auth.");
}

const localHttpsConfigured = (() => {
  const certPath = path.resolve(".certs/localhost.pem");
  const keyPath = path.resolve(".certs/localhost-key.pem");
  return fs.existsSync(certPath) && fs.existsSync(keyPath);
})();

if ((process.env.NODE_ENV === "production" || localHttpsConfigured) && !process.env.BETTER_AUTH_URL) {
  throw new Error(
    "BETTER_AUTH_URL is required in production and whenever local HTTPS certs are enabled.",
  );
}

if (
  (process.env.NODE_ENV === "production" || localHttpsConfigured) &&
  process.env.BETTER_AUTH_URL?.startsWith("http://")
) {
  throw new Error("BETTER_AUTH_URL must use https:// in production and local HTTPS mode.");
}

const defaultProtocol =
  process.env.BETTER_AUTH_URL?.startsWith("https://") ||
  process.env.NODE_ENV === "production"
    ? "https"
    : "http";

const defaultHost = process.env.HOST || "localhost";
const defaultPort = process.env.PORT || "3000";

const baseURL =
  process.env.BETTER_AUTH_URL || `${defaultProtocol}://${defaultHost}:${defaultPort}`;

// Better Auth validates every absolute `callbackURL` the client passes (e.g.
// `${window.location.origin}/login?verified=1` from client/src/pages/login.tsx).
// Without `trustedOrigins`, any absolute URL is rejected with "Invalid callbackURL",
// blocking sign-in, sign-up, magic-link, and verification flows. We trust:
//   - baseURL (Better Auth's canonical origin)
//   - the origin the Express server is actually listening on (can differ from
//     BETTER_AUTH_URL in dev when a shared .env sets the public origin but the
//     process runs on a different port)
//   - any explicit additions from BETTER_AUTH_TRUSTED_ORIGINS (comma-separated)
const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const listenOrigin = `${defaultProtocol}://${defaultHost}:${defaultPort}`;

export const trustedOrigins = Array.from(
  new Set([baseURL, listenOrigin, ...extraTrustedOrigins]),
);

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: authSecret,
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    // Verification email is still sent on sign-up (see emailVerification below), but not required
    // to sign in. Users who want to verify can; users who don't are not blocked.
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  emailVerification: {
    sendOnSignUp: canSendAuthEmail() || process.env.NODE_ENV !== "production",
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },
  account: {
    encryptOAuthTokens: true,
    // Account linking: if a user signs up with email/password and later uses Google OAuth,
    // Better Auth merges the accounts IF the emails match and Google is trusted.
    // allowDifferentEmails: false means linking is blocked when emails differ — prevents
    // accidental merging of distinct identities.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/magic-link/verify": { window: 60, max: 5 },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          prompt: "select_account",
        },
      }
    : undefined,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await sendMagicLinkEmail({ email, url });
        } catch (err) {
          // Better Auth swallows our throw and returns a generic 500; capture
          // the underlying provider message (e.g. Resend "domain not verified")
          // so the failure isn't invisible. Email + truncated url only — never
          // log the full magic-link URL because it's a single-use credential.
          logger.error(
            { err, email, urlPrefix: url.slice(0, 80) },
            "[auth] magic-link send failed",
          );
          throw err;
        }
      },
      storeToken: "hashed",
      // Token TTL: 15 min is friendlier for mobile paste UX than the 5-min default.
      expiresIn: 60 * 15,
      rateLimit: {
        window: 60,
        max: 3,
      },
    }),
  ],
});

export const extractUser: RequestHandler = async (req: any, _res, next) => {
  req.authSession = null;
  req.user = null;
  req.userId = null;

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    req.authSession = session;
    req.user = session?.user ?? null;
    req.userId = session?.user?.id ?? null;
  } catch (err) {
    // Better Auth can throw on transient KV/DB errors, malformed cookies, or
    // expired/revoked sessions. We don't propagate (requireAuth handles 401),
    // but we DO log so operational issues aren't invisible — silently treating
    // every error as "no session" hid the long-running BETTER_AUTH_URL trailing-\n
    // bug for ~2 weeks because every getSession() call was rejecting.
    req.authSession = null;
    req.user = null;
    req.userId = null;
    logger.warn({ err, path: req.path }, "[auth] extractUser failed; treating as anonymous");
  }

  next();
};

export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
