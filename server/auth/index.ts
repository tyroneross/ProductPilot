import type { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { betterAuth } from "better-auth";
import { logger } from "../lib/logger";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import { dash } from "@better-auth/infra";
import { db } from "../db";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import * as authSchema from "./schema";

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

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  baseURL,
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
      void sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url,
      }).catch((error) => {
        logger.error({ err: error }, "[auth] Failed to send password reset email");
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      }).catch((error) => {
        logger.error({ err: error }, "[auth] Failed to send verification email");
      });
    },
  },
  account: {
    // Account linking: if a user signs up with email/password and later uses Google OAuth
    // (or vice versa), Better Auth merges the accounts IF the emails match.
    // allowDifferentEmails: false means linking is blocked when emails differ — prevents
    // accidental merging of distinct identities.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
      allowDifferentEmails: false,
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
    // Dashboard / analytics / audit log plugin. Only activates when the three env vars are set;
    // otherwise the constructor is skipped so local dev without Upstash still works.
    ...(process.env.BETTER_AUTH_API_KEY && process.env.BETTER_AUTH_KV_URL
      ? [
          dash({
            apiUrl: process.env.BETTER_AUTH_API_URL,
            kvUrl: process.env.BETTER_AUTH_KV_URL,
            apiKey: process.env.BETTER_AUTH_API_KEY,
          }),
        ]
      : []),
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
  } catch {
    req.authSession = null;
    req.user = null;
    req.userId = null;
  }

  next();
};

export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
