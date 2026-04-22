import { createAuthClient } from "better-auth/react";

const authOrigin =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: authOrigin,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include" as RequestCredentials,
  },
});
