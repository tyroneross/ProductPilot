import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth";
import { registerRoutes } from "../routes";
import { runMigrations } from "../migrate";
import { initSentry, Sentry } from "../lib/sentry";
import { logger } from "../lib/logger";

initSentry();

let appInitialized = false;
const app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function ensureInitialized() {
  if (appInitialized) return;

  try {
    await runMigrations();
  } catch (error) {
    logger.warn({ err: error }, "Skipping migrations");
  }

  await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
    Sentry.captureException(err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  appInitialized = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureInitialized();
  app(req as any, res as any);
}
