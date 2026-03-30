import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../routes";
import { runMigrations } from "../migrate";

let appInitialized = false;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function ensureInitialized() {
  if (appInitialized) return;

  try {
    await runMigrations();
  } catch (error) {
    console.log(
      "Skipping migrations:",
      error instanceof Error ? error.message : error,
    );
  }

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
