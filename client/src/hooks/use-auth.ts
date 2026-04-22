import { authClient } from "@/lib/auth";

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
