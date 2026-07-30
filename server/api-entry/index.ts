import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth";
import { registerRoutes } from "../routes";
import { runMigrations } from "../migrate";
import { initSentry, Sentry } from "../lib/sentry";
import { logger } from "../lib/logger";
import { terminalErrorHandler } from "../lib/error-handler";

initSentry();

let appInitialized = false;
const app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

async function ensureInitialized() {
  if (appInitialized) return;

  try {
    await runMigrations();
  } catch (error) {
    logger.warn({ err: error }, "Skipping migrations");
  }

  await registerRoutes(app);

  app.use(terminalErrorHandler);

  appInitialized = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureInitialized();
  app(req as any, res as any);
}
