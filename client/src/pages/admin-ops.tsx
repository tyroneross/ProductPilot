import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Nav from "@/components/nav";

/**
 * Admin operations overview.
 *
 * Reachable only through AdminOnly; non-admins get the ordinary 404. Read-only
 * by design — there are no controls here, because every decision this page
 * informs (recovering stranded projects, raising a spend limit) is one a human
 * should make deliberately elsewhere, not from a dashboard button.
 *
 * Warm Craft tokens: #110f0d ground, #f0b65e accent, #f5f0eb primary text.
 */

type OpsSummary = {
  users: { registeredAccounts: number; accountsWithProjects: number; distinctGuests: number; guestsWithRealWork: number };
  ownership: { accountOwned: number; guestOwnedAtRisk: number; strandedProjects: number; orphaned: number; totalProjects: number };
  engagement: { projectsPerGuest: Array<{ projects: number; guests: number }>; totalStages: number; totalMessages: number };
  spend: { windowDays: number; calls: number; inputTokens: number; outputTokens: number; costUsd: number; errorCalls: number; byModel: Array<{ model: string; calls: number; costUsd: number }> };
  providers: Record<string, { ok: boolean; errorCode: string | null; latencyMs: number }>;
  modelFallback: { available: boolean; disabledByKillSwitch: boolean; coversAccountBlock: boolean; engagements: number; lastEngagedAt: string | null };
  generatedAt: string;
};

const C = {
  bg: "#110f0d",
  surface: "rgba(255,255,255,0.03)",
  border: "rgba(200,180,160,0.08)",
  text: "#f5f0eb",
  secondary: "#a89a8c",
  muted: "#6b5d52",
  accent: "#f0b65e",
  warn: "#e0a458",
  bad: "#e07070",
  good: "#7fb069",
};

function nf(n: number) {
  return n.toLocaleString();
}

/** Numeric value + semantic label. A bare number on a dashboard is a riddle. */
function Stat({ value, label, tone, hint }: { value: string; label: string; tone?: string; hint?: string }) {
  return (
    <div style={{ padding: "16px 20px", minWidth: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: tone ?? C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: C.secondary, marginTop: 4 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** One border around the group, dividers between members. */
function Group({ title, children, columns = 4 }: { title: string; children: React.ReactNode; columns?: number }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 8, fontWeight: 600 }}>
        {title}
      </h2>
      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          background: C.surface,
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
          overflow: "hidden",
        }}
        data-columns={columns}
      >
        {children}
      </div>
    </section>
  );
}

export default function AdminOpsPage() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch, isFetching } = useQuery<OpsSummary>({
    queryKey: ["/api/admin/ops-summary"],
    staleTime: 30_000,
  });

  const providerEntries = Object.entries(data?.providers ?? {});
  const anyProviderDown = providerEntries.some(([, p]) => !p.ok);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Nav />
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>Operations</h1>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              marginLeft: "auto", minHeight: 44, padding: "0 14px", fontSize: 13,
              background: "transparent", color: isFetching ? C.muted : C.accent,
              border: `1px solid ${C.border}`, borderRadius: 8, cursor: isFetching ? "default" : "pointer",
            }}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p style={{ fontSize: 13, color: C.secondary, marginBottom: 24 }}>
          {data ? `Live counts as of ${new Date(data.generatedAt).toLocaleString()}.` : "Live counts from the production database."}
        </p>

        {isLoading && <p style={{ color: C.secondary, fontSize: 14 }}>Loading operations summary…</p>}

        {isError && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, background: C.surface }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Couldn't load the summary</div>
            <div style={{ fontSize: 13, color: C.secondary, marginBottom: 12 }}>
              The request failed before returning any counts. Nothing is wrong with your data.
            </div>
            <button
              onClick={() => refetch()}
              style={{ minHeight: 44, padding: "0 16px", background: C.accent, color: "#1a1410", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            <Group title="People">
              <Stat value={nf(data.users.guestsWithRealWork)} label="Guests who generated something" hint="≥1 stage with progress" />
              <Stat value={nf(data.users.distinctGuests)} label="Distinct guests" />
              <Stat value={nf(data.users.accountsWithProjects)} label="Accounts with a project" />
              <Stat value={nf(data.users.registeredAccounts)} label="Registered accounts" />
            </Group>

            <Group title="Project ownership">
              <Stat
                value={nf(data.ownership.strandedProjects)}
                label="Stranded"
                tone={data.ownership.strandedProjects > 0 ? C.bad : C.text}
                hint="Guest-owned, past the 30-day cookie — unreachable"
              />
              <Stat
                value={nf(data.ownership.guestOwnedAtRisk)}
                label="At risk"
                tone={data.ownership.guestOwnedAtRisk > 0 ? C.warn : C.text}
                hint="Guest-owned, still inside the window"
              />
              <Stat value={nf(data.ownership.accountOwned)} label="Attached to an account" tone={C.good} />
              <Stat value={nf(data.ownership.totalProjects)} label="Projects total" hint={`${nf(data.engagement.totalStages)} stages · ${nf(data.engagement.totalMessages)} messages`} />
            </Group>

            <Group title="Provider">
              {providerEntries.length === 0 ? (
                <Stat value="None" label="No provider key configured" tone={C.bad} />
              ) : (
                providerEntries.map(([name, p]) => (
                  <Stat
                    key={name}
                    value={p.ok ? "OK" : "Down"}
                    label={name}
                    tone={p.ok ? C.good : C.bad}
                    hint={p.ok ? `${p.latencyMs}ms` : (p.errorCode ?? "unreachable")}
                  />
                ))
              )}
              <Stat
                value={data.modelFallback.engagements > 0 ? nf(data.modelFallback.engagements) : data.modelFallback.available ? "Ready" : "Off"}
                label="Model fallback"
                tone={data.modelFallback.available ? C.text : C.muted}
                hint={
                  data.modelFallback.engagements > 0
                    ? `last ${new Date(data.modelFallback.lastEngagedAt!).toLocaleString()}`
                    : "never engaged · does not cover an account block"
                }
              />
            </Group>

            <Group title={`Spend · last ${data.spend.windowDays} days`}>
              <Stat value={`$${data.spend.costUsd.toFixed(2)}`} label="Cost" tone={C.accent} />
              <Stat value={nf(data.spend.calls)} label="LLM calls" hint={`${nf(data.spend.errorCalls)} failed`} tone={C.text} />
              <Stat value={nf(data.spend.inputTokens)} label="Input tokens" />
              <Stat value={nf(data.spend.outputTokens)} label="Output tokens" />
            </Group>

            {data.spend.byModel.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                  By model
                </h2>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {data.spend.byModel.map((m, i) => (
                        <tr key={m.model} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                          <td style={{ padding: "12px 20px", color: C.text, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{m.model}</td>
                          <td style={{ padding: "12px 20px", color: C.secondary, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{nf(m.calls)} calls</td>
                          <td style={{ padding: "12px 20px", color: C.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>${m.costUsd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {data.engagement.projectsPerGuest.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                  Return behaviour
                </h2>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: "16px 20px" }}>
                  {data.engagement.projectsPerGuest.map((r) => (
                    <div key={r.projects} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: C.secondary, width: 92, flexShrink: 0 }}>
                        {r.projects} project{r.projects === 1 ? "" : "s"}
                      </span>
                      <span
                        style={{
                          height: 6, borderRadius: 3, background: C.accent, flexShrink: 0,
                          width: `${Math.max(2, (r.guests / Math.max(...data.engagement.projectsPerGuest.map((x) => x.guests))) * 60)}%`,
                          opacity: 0.75,
                        }}
                      />
                      <span style={{ fontSize: 12, color: C.text, fontVariantNumeric: "tabular-nums" }}>{r.guests}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Guests, grouped by how many projects they created.</p>
                </div>
              </section>
            )}

            {anyProviderDown && (
              <p style={{ fontSize: 12, color: C.warn, marginTop: 16 }}>
                A provider is failing right now. Document generation is affected for every user.
              </p>
            )}

            <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
              {[
                { label: "LLM calls", to: "/admin/llm" },
                { label: "Audit log", to: "/admin/audit" },
                { label: "Prompts", to: "/admin" },
              ].map((l) => (
                <button
                  key={l.to}
                  onClick={() => setLocation(l.to)}
                  style={{ background: "none", border: "none", color: C.accent, fontSize: 13, cursor: "pointer", padding: "8px 0", minHeight: 44 }}
                >
                  {l.label} →
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
