import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  background: "#231f1b",
  border: "1px solid rgba(200,180,160,0.12)",
  borderRadius: "7px",
  padding: "0 12px",
  fontSize: "14px",
  color: "#f5f0eb",
  fontFamily: "inherit",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, signIn, signUp, sendVerificationEmail } = useAuth();

  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);

  // Magic link state
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const nameInputId = "auth-name";
  const emailInputId = "auth-email";
  const passwordInputId = "auth-password";

  const verificationCallbackURL =
    typeof window !== "undefined"
      ? `${window.location.origin}/login?verified=1`
      : "/login?verified=1";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") !== "1") {
      return;
    }

    setAuthTab("signin");
    setAuthError("");
    setAuthInfo("Email verified. Sign in to continue.");
    setCanResendVerification(false);

    params.delete("verified");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  function isVerificationError(message: string) {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("email not verified") ||
      normalized.includes("verify your email") ||
      normalized.includes("verify your account")
    );
  }

  // Redirect if already authenticated
  if (!isLoading && isAuthenticated) {
    setLocation("/projects");
    return null;
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#110f0d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "3px solid rgba(200,180,160,0.12)",
            borderTopColor: "#f0b65e",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  function handleGoogleSignIn() {
    setAuthError("");
    setAuthInfo("");
    setCanResendVerification(false);
    setAuthLoading(true);

    authClient
      .signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/projects`,
      })
      .then((result) => {
        if (result.error) {
          throw result.error;
        }
        const data = result as any;
        const redirectUrl = data?.data?.url || data?.url;
        if (typeof redirectUrl === "string" && redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
        setAuthLoading(false);
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : "Failed to start Google sign-in");
        setAuthLoading(false);
      });
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthInfo("");
    setCanResendVerification(false);
    setAuthLoading(true);
    try {
      if (authTab === "signin") {
        await signIn(authEmail, authPassword, { callbackURL: verificationCallbackURL });
        setLocation("/projects");
      } else {
        await signUp(authEmail, authPassword, authName, {
          callbackURL: verificationCallbackURL,
        });
        setAuthTab("signin");
        setAuthPassword("");
        setAuthInfo("Check your email to verify your account, then sign in.");
        setCanResendVerification(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      if (isVerificationError(message)) {
        setAuthInfo("Check your email to verify your account, then sign in.");
        setCanResendVerification(true);
      } else {
        setAuthError(message);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!authEmail.trim()) {
      setAuthError("Enter your email address first.");
      return;
    }

    setAuthError("");
    setAuthInfo("");
    setAuthLoading(true);

    try {
      await sendVerificationEmail(authEmail, { callbackURL: verificationCallbackURL });
      setAuthInfo("Verification email sent. Check your inbox.");
      setCanResendVerification(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send verification email";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!authEmail.trim()) {
      setAuthError("Enter your email address first.");
      return;
    }
    setAuthError("");
    setAuthInfo("");
    setMagicLinkSent(false);
    setMagicLinkLoading(true);
    try {
      const callbackURL =
        typeof window !== "undefined"
          ? `${window.location.origin}/projects`
          : "/projects";
      const result = await authClient.signIn.magicLink({ email: authEmail.trim(), callbackURL });
      if (result?.error) {
        const msg =
          typeof result.error === "object" && result.error !== null && "message" in result.error
            ? String((result.error as { message?: string }).message ?? "Something went wrong")
            : "Something went wrong";
        setAuthError(msg);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setMagicLinkLoading(false);
    }
  }

  function openForgotPassword() {
    setForgotEmail(authEmail); // pre-fill if user already typed their email
    setForgotDone(false);
    setForgotError("");
    setForgotOpen(true);
  }

  function closeForgotPassword() {
    setForgotOpen(false);
    setForgotDone(false);
    setForgotError("");
    setForgotEmail("");
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotError("");
    setForgotLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "/reset-password";
      const result = await authClient.requestPasswordReset({ email: forgotEmail.trim(), redirectTo });
      if (result.error) {
        setForgotError(
          typeof result.error === "object" && result.error !== null && "message" in result.error
            ? String((result.error as { message?: string }).message ?? "Something went wrong")
            : "Something went wrong",
        );
      } else {
        setForgotDone(true);
      }
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#110f0d",
        color: "#f5f0eb",
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
        padding: "1.5rem",
        position: "relative",
      }}
    >
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 600px 400px at 50% 20%, rgba(240,182,94,0.04), transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Forgot password overlay */}
      {forgotOpen && (
        <>
          <div
            onClick={closeForgotPassword}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 10,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 11,
              width: "100%",
              maxWidth: "380px",
              background: "#1a1714",
              border: "1px solid rgba(200,180,160,0.12)",
              borderRadius: "14px",
              padding: "1.75rem",
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeForgotPassword}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b5d52",
                fontSize: "18px",
                lineHeight: 1,
                padding: "4px",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>

            <p
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#f5f0eb",
                margin: "0 0 0.375rem",
              }}
            >
              Reset your password
            </p>
            <p style={{ fontSize: "13px", color: "#a89a8c", margin: "0 0 1.25rem" }}>
              Enter your email and we'll send you a reset link.
            </p>

            {forgotDone ? (
              <p style={{ fontSize: "13px", color: "#8dbb8b", margin: 0 }}>
                If an account exists for this email, we've sent a reset link. Check your inbox.
              </p>
            ) : (
              <form
                onSubmit={handleForgotSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
              >
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)";
                    e.currentTarget.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                  }}
                />

                {forgotError && (
                  <p style={{ fontSize: "13px", color: "#e06356", margin: 0 }}>
                    {forgotError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail.trim()}
                  style={{
                    height: "44px",
                    background:
                      forgotLoading || !forgotEmail.trim()
                        ? "rgba(240,182,94,0.5)"
                        : "#f0b65e",
                    color: "#110f0d",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: forgotLoading || !forgotEmail.trim() ? "not-allowed" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {forgotLoading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "420px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 10 10"
              aria-hidden="true"
            >
              <rect
                x="1"
                y="1"
                width="8"
                height="8"
                rx="1.5"
                fill="#f0b65e"
                transform="rotate(45 5 5)"
              />
            </svg>
            <span
              style={{
                fontWeight: 700,
                fontSize: "24px",
                color: "#f5f0eb",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              ProductPilot
            </span>
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "#a89a8c",
              margin: 0,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Sign in to save your projects and configure your AI
          </p>
        </div>

        {/* Auth card */}
        <div
          style={{
            background: "#1a1714",
            border: "1px solid rgba(200,180,160,0.08)",
            borderRadius: "14px",
            padding: "1.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: "100%",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              background: "#f5f0eb",
              color: "#110f0d",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Demo mode — promoted alternative path (NN/g: primary action visible, weighted appropriately) */}
          <button
            type="button"
            onClick={() => setLocation("/details")}
            data-testid="button-demo-mode"
            style={{
              width: "100%",
              minHeight: "44px",
              padding: "6px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              background: "transparent",
              color: "#f5f0eb",
              border: "1px solid rgba(240,182,94,0.32)",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              marginBottom: "1.25rem",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(240,182,94,0.55)";
              e.currentTarget.style.background = "rgba(240,182,94,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(240,182,94,0.32)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span>Try demo mode →</span>
            <span style={{ fontSize: "11px", color: "#a89a8c", fontWeight: 400 }}>
              No account · Groq Llama 3.3
            </span>
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "1.25rem",
            }}
          >
            <div
              style={{ flex: 1, height: "1px", background: "rgba(200,180,160,0.12)" }}
            />
            <span style={{ fontSize: "12px", color: "#6b5d52" }}>
              or use email
            </span>
            <div
              style={{ flex: 1, height: "1px", background: "rgba(200,180,160,0.12)" }}
            />
          </div>

          {/* Tab toggle */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: "1.5rem",
              background: "#231f1b",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            {(["signin", "signup"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setAuthTab(tab);
                  setAuthError("");
                }}
                style={{
                  flex: 1,
                  minHeight: "44px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s",
                  background: authTab === tab ? "#1a1714" : "transparent",
                  color: authTab === tab ? "#f5f0eb" : "#6b5d52",
                  boxShadow:
                    authTab === tab ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                }}
              >
                {tab === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleAuthSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
          >
            {authTab === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor={nameInputId}
                  style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}
                >
                  Name
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)";
                    e.currentTarget.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor={emailInputId}
                style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}
              >
                Email
              </label>
              <input
                id={emailInputId}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)";
                  e.currentTarget.style.outline = "none";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <label
                  htmlFor={passwordInputId}
                  style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}
                >
                  Password
                </label>
                {authTab === "signin" && (
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "12px 4px",
                      marginRight: "-4px",
                      minHeight: "44px",
                      fontSize: "12px",
                      color: "#6b5d52",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#a89a8c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#6b5d52";
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id={passwordInputId}
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={authTab === "signin" ? "current-password" : "new-password"}
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)";
                  e.currentTarget.style.outline = "none";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                }}
              />
            </div>

            {authError && (
              <p style={{ fontSize: "13px", color: "#e06356", margin: 0 }}>
                {authError}
              </p>
            )}

            {authInfo && (
              <p style={{ fontSize: "13px", color: "#8dbb8b", margin: 0 }}>
                {authInfo}
              </p>
            )}

            {canResendVerification && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={authLoading}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "13px",
                  color: "#f0b65e",
                  cursor: authLoading ? "not-allowed" : "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                Resend verification email
              </button>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                height: "44px",
                background: authLoading ? "rgba(240,182,94,0.5)" : "#f0b65e",
                color: "#110f0d",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: authLoading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                marginTop: "4px",
              }}
            >
              {authLoading
                ? "Please wait…"
                : authTab === "signin"
                ? "Sign In"
                : "Sign Up"}
            </button>

            {authTab === "signin" && (
              <>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={magicLinkLoading || authLoading}
                  style={{
                    height: "44px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: "transparent",
                    color: magicLinkLoading || authLoading ? "#6b5d52" : "#a89a8c",
                    border: "1px solid rgba(200,180,160,0.18)",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: magicLinkLoading || authLoading ? "not-allowed" : "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                    marginTop: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (!magicLinkLoading && !authLoading) {
                      e.currentTarget.style.borderColor = "rgba(200,180,160,0.35)";
                      e.currentTarget.style.color = "#f5f0eb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(200,180,160,0.18)";
                    e.currentTarget.style.color = magicLinkLoading || authLoading ? "#6b5d52" : "#a89a8c";
                  }}
                >
                  <Mail size={16} />
                  {magicLinkLoading ? "Sending…" : "Continue with Magic Link"}
                </button>
                {magicLinkSent && (
                  <p style={{ fontSize: "13px", color: "#8dbb8b", margin: 0 }}>
                    Check your email for a sign-in link. It expires in 15 minutes.
                  </p>
                )}
              </>
            )}

            {authTab === "signup" && (
              <p style={{ fontSize: "12px", color: "#6b5d52", margin: 0, lineHeight: 1.5 }}>
                Email sign-up sends a verification link before the account can sign in.
              </p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
