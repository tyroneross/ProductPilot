import { useLocation } from "wouter";

export default function WelcomePage() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Background glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(240,182,94,0.04), transparent)",
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
          {/* Wordmark */}
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
            {/* Amber diamond */}
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1" y="1" width="8" height="8" rx="1.5" fill="#f0b65e" transform="rotate(45 5 5)" />
            </svg>
            ProductPilot
          </button>

          {/* Nav links */}
          <ul style={{ display: "flex", alignItems: "center", gap: "1.5rem", listStyle: "none", margin: 0, padding: 0 }}>
            <li>
              <NavLink onClick={() => setLocation("/projects")}>Projects</NavLink>
            </li>
            <li>
              <NavLink onClick={() => setLocation("/auth")}>Sign In</NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <section
          style={{
            minHeight: "calc(100vh - 56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem 1.5rem",
          }}
        >
          <div
            style={{
              maxWidth: "36rem",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Pill badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(240,182,94,0.10)",
                color: "#f0b65e",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "9999px",
                padding: "4px 12px",
                marginBottom: "28px",
                border: "1px solid rgba(240,182,94,0.18)",
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f0b65e", flexShrink: 0 }}
              />
              AI-Powered Product Development
            </span>

            {/* H1 */}
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.12,
                color: "#f5f0eb",
                textShadow: "0 0 80px rgba(240,182,94,0.15)",
                marginBottom: "20px",
                marginTop: 0,
              }}
            >
              From idea to implementation docs in minutes
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "18px",
                color: "#a89a8c",
                lineHeight: 1.6,
                maxWidth: "28rem",
                margin: "0 auto 36px",
              }}
            >
              Describe what you want to build. Get a complete PRD, wireframes, architecture, and dev guide.
            </p>

            {/* CTA button */}
            <button
              onClick={() => setLocation("/details")}
              data-testid="button-get-started"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f0b65e",
                color: "#110f0d",
                fontFamily: "inherit",
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                height: "48px",
                padding: "0 2rem",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                marginBottom: "12px",
                transition: "background 0.2s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#d4a04e";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f0b65e";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              Start Building →
            </button>

            {/* Sub-label */}
            <span style={{ fontSize: "13px", color: "#6b5d52", letterSpacing: "0.01em" }}>
              No account required · Free to try
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

function NavLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        color: "#a89a8c",
        fontFamily: "inherit",
        padding: 0,
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f0b65e"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#a89a8c"; }}
    >
      {children}
    </button>
  );
}
