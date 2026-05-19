import { useState } from "react";
import { useLocation } from "wouter";

// Persistent, navigable breadcrumb. Replaces single weak back-links so a
// first-time user always sees the full hierarchy (Projects › Project ›
// Documents › …) with every prior level clickable.
//
// calm-precision nav-state: the current level is conveyed by text weight, never
// a background pill; prior levels are quiet interactive links. Warm Craft tokens.

export interface Crumb {
  label: string;
  href?: string;
}

const SEP_COLOR = "#6b5d52";
const LINK_COLOR = "#a89a8c";
const CURRENT_COLOR = "#f5f0eb";

function Separator() {
  return (
    <span aria-hidden="true" style={{ color: SEP_COLOR, margin: "0 8px", fontSize: 13, userSelect: "none" }}>
      ›
    </span>
  );
}

function CrumbLink({ label, href }: { label: string; href: string }) {
  const [, setLocation] = useLocation();
  return (
    <button
      type="button"
      className="crumb-link"
      onClick={() => setLocation(href)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: LINK_COLOR,
        fontSize: 13,
        fontFamily: "inherit",
        // ≥24px desktop / ≥44px mobile hit area via padding, no visual box.
        padding: "2px 0",
        minHeight: 24,
        transition: "color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = CURRENT_COLOR)}
      onMouseLeave={(e) => (e.currentTarget.style.color = LINK_COLOR)}
    >
      {label}
    </button>
  );
}

function CrumbCurrent({ label }: { label: string }) {
  return (
    <span
      aria-current="page"
      style={{
        color: CURRENT_COLOR,
        fontWeight: 600,
        fontSize: 13,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 320,
      }}
    >
      {label}
    </span>
  );
}

export default function Breadcrumb({ segments }: { segments: Crumb[] }) {
  const [expanded, setExpanded] = useState(false);

  if (segments.length === 0) return null;

  const renderItem = (c: Crumb, isLast: boolean, key: number) => (
    <li key={key} style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
      {c.href && !isLast ? <CrumbLink label={c.label} href={c.href} /> : <CrumbCurrent label={c.label} />}
      {!isLast && <Separator />}
    </li>
  );

  const collapsible = segments.length > 3;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const middle = segments.slice(1, -1);

  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 10 }}>
      <style>{`
        .crumb-link:focus-visible {
          outline: 2px solid rgba(240,182,94,0.5);
          outline-offset: 2px;
          border-radius: 3px;
        }
        @media (max-width: 480px) {
          .crumb-link { min-height: 44px; padding-top: 8px; padding-bottom: 8px; }
          .crumb-full { display: ${collapsible && !expanded ? "none" : "inline-flex"} !important; }
          .crumb-collapsed { display: ${collapsible && !expanded ? "inline-flex" : "none"} !important; }
        }
        @media (min-width: 481px) {
          .crumb-collapsed { display: none !important; }
        }
      `}</style>

      {/* Full path — always on >480px; on mobile only when not collapsed. */}
      <ol
        className="crumb-full"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {segments.map((c, i) => renderItem(c, i === segments.length - 1, i))}
      </ol>

      {/* Collapsed path (mobile, >3 segments): first … current */}
      {collapsible && (
        <ol
          className="crumb-collapsed"
          style={{ listStyle: "none", margin: 0, padding: 0, alignItems: "center" }}
        >
          {first.href ? (
            <li style={{ display: "inline-flex", alignItems: "center" }}>
              <CrumbLink label={first.label} href={first.href} />
              <Separator />
            </li>
          ) : null}
          {middle.length > 0 && (
            <li style={{ display: "inline-flex", alignItems: "center" }}>
              <button
                type="button"
                className="crumb-link"
                aria-label="Show full path"
                onClick={() => setExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: LINK_COLOR,
                  fontSize: 13,
                  fontFamily: "inherit",
                  padding: "2px 4px",
                  minHeight: 24,
                }}
              >
                …
              </button>
              <Separator />
            </li>
          )}
          <li style={{ display: "inline-flex", alignItems: "center" }}>
            <CrumbCurrent label={last.label} />
          </li>
        </ol>
      )}
    </nav>
  );
}
