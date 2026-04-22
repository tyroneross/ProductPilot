import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { authClient } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  function validate(): string | null {
    if (newPassword.length < 8) return "Password must be at least 8 characters.";
    if (newPassword.length > 128) return "Password is too long.";
    if (newPassword !== confirmPassword) return "Passwords don't match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!token) {
      setError("Reset link is missing a token. Please request a new reset link.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        const msg =
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error
            ? String((result.error as { message?: string }).message ?? "")
            : "";
        setError(msg || "Reset link is invalid or has expired. Please request a new one.");
      } else {
        toast({
          title: "Password reset",
          description: "You can now sign in with your new password.",
        });
        setLocation("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const noToken = token === null && typeof window !== "undefined";

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
            <svg width="22" height="22" viewBox="0 0 10 10" aria-hidden="true">
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
        </div>

        {/* Card */}
        <div
          style={{
            background: "#1a1714",
            border: "1px solid rgba(200,180,160,0.08)",
            borderRadius: "14px",
            padding: "1.75rem",
          }}
        >
          <p
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#f5f0eb",
              margin: "0 0 0.375rem",
            }}
          >
            Set a new password
          </p>
          <p style={{ fontSize: "13px", color: "#a89a8c", margin: "0 0 1.5rem" }}>
            Choose a password at least 8 characters long.
          </p>

          {noToken ? (
            <div>
              <p style={{ fontSize: "13px", color: "#e06356", margin: "0 0 1rem" }}>
                This reset link is missing a token. Please request a new password reset.
              </p>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                style={{
                  height: "44px",
                  width: "100%",
                  background: "#f0b65e",
                  color: "#110f0d",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="new-password"
                  style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={128}
                  autoFocus
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
                <label
                  htmlFor="confirm-password"
                  style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}
                >
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={128}
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

              {error && (
                <p style={{ fontSize: "13px", color: "#e06356", margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: "44px",
                  background: loading ? "rgba(240,182,94,0.5)" : "#f0b65e",
                  color: "#110f0d",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  marginTop: "4px",
                }}
              >
                {loading ? "Please wait…" : "Reset password"}
              </button>

              <p style={{ textAlign: "center", margin: 0 }}>
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "13px",
                    color: "#6b5d52",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#a89a8c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#6b5d52";
                  }}
                >
                  Back to sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
