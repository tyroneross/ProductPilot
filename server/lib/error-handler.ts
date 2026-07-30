import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { Sentry } from "./sentry";
import { toSafeUserMessage } from "../services/ai";

/**
 * Terminal Express error handler, shared by the standalone server and the
 * Vercel function entrypoint so the two cannot drift.
 *
 * It previously did `res.status(err.status || 500).json({ message: err.message })`,
 * which had two problems for provider errors that escaped a route's own catch:
 *
 *   1. `err.message` on an SDK error is the provider's serialized JSON body.
 *      That is how the 2026-07-29 Groq spend-block payload could reach a
 *      browser verbatim. The body can also echo the user's own prompt back
 *      (Groq attaches `failed_generation`), so it is never safe to reflect.
 *
 *   2. `err.status` reflected the PROVIDER's status as the APP's status. A
 *      provider 400 became a 400 from us, which tells the caller their request
 *      was malformed when it was not, and leaks which faults are upstream.
 *
 * Now: classify first, fall back to fixed copy, and only honor `err.status`
 * when the app itself set it (an Express/http-errors style 4xx). Anything
 * else becomes a 500.
 */
export function terminalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  Sentry.captureException(err);

  if (res.headersSent) return;

  const safe = toSafeUserMessage(err, "groq", "Internal Server Error");

  // Only trust a status the app set on a plain http-error. A provider SDK error
  // carries its own numeric .status; classification having recognized the error
  // is the tell that it came from upstream, not from us.
  const appStatus = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : null;
  const status =
    safe.errorCode !== null
      ? 502 // recognized upstream provider fault — a bad gateway, not a bad request
      : appStatus !== null && appStatus >= 400 && appStatus < 500
        ? appStatus
        : 500;

  res.status(status).json({
    message: safe.message,
    ...(safe.errorCode ? { errorCode: safe.errorCode } : {}),
    ...(safe.retryAfterSeconds !== null ? { retryAfterSeconds: safe.retryAfterSeconds } : {}),
  });
}
