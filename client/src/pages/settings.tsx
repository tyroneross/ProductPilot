import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Provider = "groq" | "anthropic" | "openai";

const PROVIDER_DEFAULTS: Record<Provider, { label: string; subtitle: string; model: string }> = {
  groq: { label: "Groq", subtitle: "Llama 3.3 70B", model: "llama-3.3-70b-versatile" },
  anthropic: { label: "Anthropic", subtitle: "Claude Sonnet", model: "claude-sonnet-4-20250514" },
  openai: { label: "OpenAI", subtitle: "GPT-4o", model: "gpt-4o" },
};

interface SettingsResponse {
  llmProvider?: Provider;
  llmModel?: string;
  llmApiKeyMasked?: string;
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { toast } = useToast();

  // Auth form state
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // LLM config state
  const [provider, setProvider] = useState<Provider>("groq");
  const [model, setModel] = useState(PROVIDER_DEFAULTS.groq.model);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedKeyMasked, setSavedKeyMasked] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [originalProvider, setOriginalProvider] = useState<Provider>("groq");
  const [originalModel, setOriginalModel] = useState(PROVIDER_DEFAULTS.groq.model);

  // Load settings on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: SettingsResponse | null) => {
        if (!data) return;
        const p: Provider = (data.llmProvider as Provider) || "groq";
        const m = data.llmModel || PROVIDER_DEFAULTS[p].model;
        setProvider(p);
        setModel(m);
        setOriginalProvider(p);
        setOriginalModel(m);
        if (data.llmApiKeyMasked) setSavedKeyMasked(data.llmApiKeyMasked);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Track changes
  useEffect(() => {
    const changed = provider !== originalProvider || model !== originalModel || apiKey.length > 0;
    setHasChanges(changed);
  }, [provider, model, apiKey, originalProvider, originalModel]);

  function handleProviderSelect(p: Provider) {
    setProvider(p);
    setModel(PROVIDER_DEFAULTS[p].model);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authTab === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const body = authTab === "signin"
        ? { email: authEmail, password: authPassword }
        : { name: authName, email: authEmail, password: authPassword };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Authentication failed" }));
        setAuthError(err.message || "Authentication failed");
      } else {
        window.location.reload();
      }
    } catch {
      setAuthError("Network error — please try again");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSave() {
    setSettingsLoading(true);
    try {
      await apiRequest("PUT", "/api/settings", {
        llmProvider: provider,
        llmModel: model,
        ...(apiKey ? { llmApiKey: apiKey } : {}),
      });
      setOriginalProvider(provider);
      setOriginalModel(model);
      setApiKey("");
      setHasChanges(false);
      // Refresh masked key
      fetch("/api/settings", { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data: SettingsResponse | null) => {
          if (data?.llmApiKeyMasked) setSavedKeyMasked(data.llmApiKeyMasked);
        })
        .catch(() => {});
      toast({ title: "Settings saved", description: "Your LLM configuration has been updated." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleRemoveKey() {
    try {
      await apiRequest("DELETE", "/api/settings/key");
      setSavedKeyMasked(null);
      setApiKey("");
      toast({ title: "API key removed", description: "Switched back to Groq demo." });
    } catch {
      toast({ title: "Error", description: "Failed to remove API key.", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#110f0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid rgba(200,180,160,0.12)", borderTopColor: "#f0b65e", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Background glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(ellipse 600px 400px at 50% 20%, rgba(240,182,94,0.03), transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Sticky Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: "56px",
          display: "flex",
          alignItems: "center",
          background: "rgba(17,15,13,0.72)",
          backdropFilter: "blur(12px) saturate(1.2)",
          WebkitBackdropFilter: "blur(12px) saturate(1.2)",
          borderBottom: "1px solid rgba(200,180,160,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: "64rem",
            width: "100%",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setLocation("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "18px",
              color: "#f5f0eb",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1" y="1" width="8" height="8" rx="1.5" fill="#f0b65e" transform="rotate(45 5 5)" />
            </svg>
            ProductPilot
          </button>

          <ul style={{ display: "flex", alignItems: "center", gap: "1.5rem", listStyle: "none", margin: 0, padding: 0 }}>
            <li><NavLink onClick={() => setLocation("/projects")}>Projects</NavLink></li>
            <li>
              <NavLink onClick={() => setLocation("/settings")} active>
                Settings
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, position: "relative", zIndex: 1, padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: "42rem", margin: "0 auto" }}>

          {/* Page title */}
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#f5f0eb", marginBottom: "2rem", marginTop: 0, letterSpacing: "-0.02em" }}>
            Settings
          </h1>

          {/* Auth section */}
          {!isAuthenticated ? (
            <div>
              {/* Sign-in card */}
              <div
                style={{
                  background: "#1a1714",
                  border: "1px solid rgba(200,180,160,0.08)",
                  borderRadius: "12px",
                  padding: "1.75rem",
                  marginBottom: "1rem",
                }}
              >
                {/* Tab toggle */}
                <div style={{ display: "flex", gap: "0", marginBottom: "1.5rem", background: "#231f1b", borderRadius: "8px", padding: "3px" }}>
                  {(["signin", "signup"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setAuthTab(tab); setAuthError(""); }}
                      style={{
                        flex: 1,
                        height: "36px",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        transition: "background 0.15s, color 0.15s",
                        background: authTab === tab ? "#1a1714" : "transparent",
                        color: authTab === tab ? "#f5f0eb" : "#6b5d52",
                        boxShadow: authTab === tab ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                      }}
                    >
                      {tab === "signin" ? "Sign In" : "Sign Up"}
                    </button>
                  ))}
                </div>

                {/* Form */}
                <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  {authTab === "signup" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}>Name</label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Your name"
                        required
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)"; e.currentTarget.style.outline = "none"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)"; }}
                      />
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}>Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)"; e.currentTarget.style.outline = "none"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)"; }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#a89a8c" }}>Password</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)"; e.currentTarget.style.outline = "none"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)"; }}
                    />
                  </div>

                  {authError && (
                    <p style={{ fontSize: "13px", color: "#e06356", margin: 0 }}>{authError}</p>
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
                    {authLoading ? "Please wait…" : authTab === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                </form>
              </div>

              <p style={{ fontSize: "13px", color: "#6b5d52", textAlign: "center", margin: 0 }}>
                Continue without signing in — demo mode with Groq Llama 3.3
              </p>
            </div>
          ) : (
            <div>
              {/* User info bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#1a1714",
                  border: "1px solid rgba(200,180,160,0.08)",
                  borderRadius: "10px",
                  padding: "0.875rem 1.25rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  {user?.name && (
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f5f0eb" }}>{user.name}</p>
                  )}
                  <p style={{ margin: 0, fontSize: "13px", color: "#a89a8c" }}>{user?.email}</p>
                </div>
                <button
                  onClick={() => logout()}
                  style={{
                    height: "36px",
                    padding: "0 1rem",
                    background: "transparent",
                    border: "1px solid rgba(200,180,160,0.2)",
                    borderRadius: "7px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#a89a8c",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "border-color 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(200,180,160,0.4)";
                    e.currentTarget.style.color = "#f5f0eb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(200,180,160,0.2)";
                    e.currentTarget.style.color = "#a89a8c";
                  }}
                >
                  Sign Out
                </button>
              </div>

              {/* Divider */}
              <div style={{ height: "1px", background: "rgba(200,180,160,0.08)", marginBottom: "1.75rem" }} />

              {/* LLM Configuration */}
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f5f0eb", margin: "0 0 6px 0" }}>
                  LLM Configuration
                </h2>
                <p style={{ fontSize: "13px", color: "#a89a8c", margin: "0 0 1.5rem 0", lineHeight: 1.5 }}>
                  Add your own API key to use a different model. Without a key, the free Groq demo is used.
                </p>

                {/* Provider selector */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#a89a8c", marginBottom: "8px" }}>
                    Provider
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    {(["groq", "anthropic", "openai"] as Provider[]).map((p) => {
                      const selected = provider === p;
                      return (
                        <button
                          key={p}
                          onClick={() => handleProviderSelect(p)}
                          style={{
                            padding: "10px 12px",
                            background: selected ? "rgba(240,182,94,0.06)" : "#1a1714",
                            border: `1px solid ${selected ? "#f0b65e" : "rgba(200,180,160,0.08)"}`,
                            borderRadius: "8px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "border-color 0.15s, background 0.15s",
                            fontFamily: "inherit",
                          }}
                        >
                          <div style={{ fontSize: "13px", fontWeight: 600, color: selected ? "#f0b65e" : "#f5f0eb", marginBottom: "2px" }}>
                            {PROVIDER_DEFAULTS[p].label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6b5d52" }}>
                            {PROVIDER_DEFAULTS[p].subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model input */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#a89a8c", marginBottom: "6px" }}>
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)"; e.currentTarget.style.outline = "none"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)"; }}
                  />
                </div>

                {/* API Key input */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#a89a8c", marginBottom: "6px" }}>
                    API Key
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={savedKeyMasked ? savedKeyMasked : "Paste your API key..."}
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(240,182,94,0.4)"; e.currentTarget.style.outline = "none"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)"; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b5d52",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                      }}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || settingsLoading}
                  style={{
                    height: "44px",
                    width: "100%",
                    background: hasChanges && !settingsLoading ? "#f0b65e" : "rgba(240,182,94,0.2)",
                    color: hasChanges && !settingsLoading ? "#110f0d" : "#6b5d52",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: hasChanges && !settingsLoading ? "pointer" : "not-allowed",
                    transition: "background 0.2s, color 0.2s",
                    marginBottom: "1rem",
                  }}
                  onMouseEnter={(e) => {
                    if (hasChanges && !settingsLoading) e.currentTarget.style.background = "#d4a04e";
                  }}
                  onMouseLeave={(e) => {
                    if (hasChanges && !settingsLoading) e.currentTarget.style.background = "#f0b65e";
                  }}
                >
                  {settingsLoading ? "Saving…" : "Save Settings"}
                </button>

                {/* Remove key */}
                {savedKeyMasked && (
                  <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
                    <button
                      onClick={handleRemoveKey}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#6b5d52",
                        fontFamily: "inherit",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#a89a8c"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#6b5d52"; }}
                    >
                      Remove custom key (use demo)
                    </button>
                  </div>
                )}

                {/* Status line */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: savedKeyMasked ? "#f0b65e" : "#4caf7d",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "#6b5d52" }}>
                    {savedKeyMasked
                      ? `Using ${PROVIDER_DEFAULTS[provider].label} with your API key`
                      : "Using Groq Llama 3.3 (free demo)"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
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

function NavLink({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #f0b65e" : "2px solid transparent",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: active ? 600 : 500,
        color: active ? "#f5f0eb" : "#a89a8c",
        fontFamily: "inherit",
        padding: "0 0 2px 0",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#f0b65e";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#a89a8c";
      }}
    >
      {children}
    </button>
  );
}
