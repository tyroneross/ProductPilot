import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  // Serverless-friendly: no transports, JSON to stdout — Vercel/Axiom/BetterStack pipe from there.
  // In dev, pretty-print for readability.
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
    },
  }),
  base: {
    service: "productpilot",
    env: process.env.NODE_ENV || "development",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.apiKey",
      "*.api_key",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
});
