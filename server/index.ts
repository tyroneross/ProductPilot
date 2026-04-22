import express, { type Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { registerRoutes } from "./routes";
import { auth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";
import fs from "fs";
import https from "https";
import path from "path";

const app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    console.log("Skipping database migrations due to connection issues.");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
