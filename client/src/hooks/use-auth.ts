import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const DEMO_OWNER_COOKIE = "productpilot_demo_owner";

function hasGuestCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${DEMO_OWNER_COOKIE}=`));
}

type AuthFlowOptions = {
  callbackURL?: string;
};

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: string }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function useAuth() {
  const sessionState = authClient.useSession();
  const session = sessionState.data || null;
  const user = session?.user || null;

  // Attach any guest-session work to the account as soon as one exists.
  //
  // Previously the ONLY claim trigger in the whole client was the Save dialog
  // in session-survey. Build something as a guest, sign in any other way, and
  // your work stayed on a 30-day cookie — then silently became unreachable.
  // Signing in is now sufficient. Idempotent server-side; guarded here so it
  // fires once per session rather than on every re-render.
  const claimAttemptedRef = useRef(false);
  useEffect(() => {
    if (!session?.session || claimAttemptedRef.current) return;
    if (!hasGuestCookie()) return;
    claimAttemptedRef.current = true;
    void (async () => {
      try {
        const res = await apiRequest("POST", "/api/projects/claim-session", {});
        const data = await res.json().catch(() => ({ claimedCount: 0 }));
        if (data?.claimedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user/draft"] });
        }
      } catch {
        // Non-fatal: the per-project claim on save is still a second chance,
        // and retrying on the next sign-in is harmless.
        claimAttemptedRef.current = false;
      }
    })();
  }, [session?.session]);

  const signIn = async (email: string, password: string, options?: AuthFlowOptions) => {
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: options?.callbackURL,
    });
    if (result.error) {
      throw new Error(getAuthErrorMessage(result.error, "Authentication failed"));
    }
    await sessionState.refetch();
    return result.data;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    options?: AuthFlowOptions,
  ) => {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: options?.callbackURL,
    });
    if (result.error) {
      throw new Error(getAuthErrorMessage(result.error, "Authentication failed"));
    }
    await sessionState.refetch();
    return result.data;
  };

  const sendVerificationEmail = async (email: string, options?: AuthFlowOptions) => {
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: options?.callbackURL,
    });
    if (result.error) {
      throw new Error(getAuthErrorMessage(result.error, "Failed to send verification email"));
    }
    return result.data;
  };

  const signOut = async () => {
    const result = await authClient.signOut();
    if ((result as { error?: unknown } | undefined)?.error) {
      throw new Error(
        getAuthErrorMessage((result as { error?: unknown }).error, "Failed to sign out"),
      );
    }
    await sessionState.refetch();
  };

  return {
    user,
    session: session?.session || null,
    isLoading: sessionState.isPending,
    isAuthenticated: !!session?.session,
    signIn,
    signUp,
    sendVerificationEmail,
    signOut,
    logout: signOut,
    refreshSession: sessionState.refetch,
  };
}
