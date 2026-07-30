import express, { type Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { registerRoutes } from "./routes";
import { auth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";
import { initSentry, Sentry } from "./lib/sentry";
import { logger } from "./lib/logger";
import fs from "fs";
import https from "https";
import path from "path";
import { terminalErrorHandler } from "./lib/error-handler";
import { ProductionDatabaseGuardError } from "./lib/db-guard";

initSentry();

const app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Try to run database migrations on startup
  try {
    await runMigrations();
  } catch (error) {
    // A production-database guard trip is NOT a connection issue and must not
    // be downgraded to a warning — that is exactly how a dev process ends up
    // silently attached to live user data. Everything else stays best-effort.
    if (error instanceof ProductionDatabaseGuardError) {
      logger.fatal({ err: error }, "Refusing to start against the production database");
      // eslint-disable-next-line no-console -- the logger may be buffered; this must be seen
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    logger.warn({ err: error }, "Skipping database migrations due to connection issues");
  }
  
  const server = await registerRoutes(app);

  app.use(terminalErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || 'localhost';

  // Use HTTPS if local certs exist for local auth and OAuth testing.
  const certPath = path.resolve('.certs/localhost.pem');
  const keyPath = path.resolve('.certs/localhost-key.pem');
  const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (useHttps) {
    const httpsServer = https.createServer({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }, app);
    httpsServer.listen(port, host, () => {
      log(`serving on https://${host}:${port}`);
    });
  } else {
    server.listen(port, host, () => {
      log(`serving on http://${host}:${port}`);
    });
  }
})();
