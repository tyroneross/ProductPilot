import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return; // Sentry not configured — stay silent in dev
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    profilesSampleRate: 0, // enable later if @sentry/profiling-node works
    // Serverless: don't fork worker threads
    // autoSessionTracking removed — not in @sentry/node NodeOptions type (serverless default is already off)
    // Don't capture these
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  });
  initialized = true;
}

export { Sentry };
