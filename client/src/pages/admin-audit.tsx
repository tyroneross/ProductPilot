import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Nav from "@/components/nav";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, LogIn, Shield, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AuditEvent } from "@shared/schema";

// Types ─────────────────────────────────────────────────────────────────────

type ListResponse = {
  rows: AuditEvent[];
  total: number;
};

type Filters = {
  actorType: string;
  action: string;
  resourceType: string;
  actorId: string;
  resourceId: string;
};

const EMPTY_FILTERS: Filters = {
  actorType: "all",
  action: "",
  resourceType: "",
  actorId: "",
  resourceId: "",
};

const PAGE_SIZE = 50;

// Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildQueryString(filters: Filters, offset: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  if (filters.actorType && filters.actorType !== "all") params.set("actorType", filters.actorType);
  if (filters.action) params.set("action", filters.action);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.resourceId) params.set("resourceId", filters.resourceId);
  return params.toString();
}

// Page ──────────────────────────────────────────────────────────────────────

export default function AdminAuditPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const offset = page * PAGE_SIZE;
  const queryString = useMemo(() => buildQueryString(filters, offset), [filters, offset]);

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ["/api/admin/audit-events", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-events?${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: detail } = useQuery<AuditEvent>({
    queryKey: ["/api/admin/audit-events", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-events/${selectedId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated && !!selectedId,
  });

  // Auth gate — same pattern as admin.tsx
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#110f0d" }}>
        <Loader2 className="w-6 h-6 animate-spin text-[#6b5d52]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen" style={{ background: "#110f0d" }}>
        <Nav />
        <div className="flex items-center justify-center px-4" style={{ minHeight: "calc(100vh - 56px)" }}>
          <Card className="w-full max-w-sm border-[rgba(200,180,160,0.08)] shadow-sm bg-[#1a1714]">
            <CardHeader className="text-center pb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(200,180,160,0.08)] mx-auto mb-3">
                <Shield className="w-5 h-5 text-[#a89a8c]" />
              </div>
              <CardTitle className="text-[16px] font-semibold text-[#f5f0eb]">Audit Events</CardTitle>
              <p className="text-[13px] text-[#a89a8c] mt-1">Sign in to access the admin panel.</p>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Button
                onClick={() => setLocation("/login")}
                className="btn-primary h-9 px-5 text-[13px]"
                data-testid="button-audit-login"
              >
                <LogIn className="w-3.5 h-3.5 mr-2" />
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters =
    filters.actorType !== "all" ||
    filters.action !== "" ||
    filters.resourceType !== "" ||
    filters.actorId !== "" ||
    filters.resourceId !== "";

  const applyFilters = () => {
    setFilters(draft);
    setPage(0);
  };
  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(0);
  };

  const draftDiffers =
    draft.actorType !== filters.actorType ||
    draft.action !== filters.action ||
    draft.resourceType !== filters.resourceType ||
    draft.actorId !== filters.actorId ||
    draft.resourceId !== filters.resourceId;

  return (
    <div className="min-h-screen" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Nav />

      {/* Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-[#1a1714] border-b border-[rgba(200,180,160,0.08)] sticky top-[56px] z-10 h-[57px]">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#a89a8c] shrink-0" />
            <span className="text-[15px] font-semibold text-[#f5f0eb]">Audit Events</span>
            <span className="text-[11px] text-[#6b5d52] ml-1">{total.toLocaleString()}</span>
          </div>
          <AdminTabs current="audit" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* Filters ─────────────────────────────────────────────────────── */}
        <div
          className="border rounded-lg p-3 mb-4"
          style={{ borderColor: "rgba(200,180,160,0.08)", background: "#1a1714" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Actor type</label>
              <Select value={draft.actorType} onValueChange={(v) => setDraft({ ...draft, actorType: v })}>
                <SelectTrigger className="h-8 text-[13px]" data-testid="filter-actor-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Action</label>
              <Input
                className="h-8 text-[13px]"
                placeholder="e.g. stage.regenerate"
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Resource type</label>
              <Input
                className="h-8 text-[13px]"
                placeholder="e.g. project, stage"
                value={draft.resourceType}
                onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Actor ID</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="exact match"
                value={draft.actorId}
                onChange={(e) => setDraft({ ...draft, actorId: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Resource ID</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="exact match"
                value={draft.resourceId}
                onChange={(e) => setDraft({ ...draft, resourceId: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-8 px-3 text-[13px]"
                data-testid="button-reset-filters"
              >
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={applyFilters}
              disabled={!draftDiffers}
              className={`h-8 px-3 text-[13px] ${draftDiffers ? "btn-primary" : ""}`}
              data-testid="button-apply-filters"
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Apply
            </Button>
          </div>
        </div>

        {/* Table ──────────────────────────────────────────────────────── */}
        <div
          className="border rounded-lg overflow-hidden"
          style={{ borderColor: "rgba(200,180,160,0.08)", background: "#1a1714" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[#6b5d52]" />
            </div>
          ) : error ? (
            <div className="py-10 text-center text-[13px] text-[#a89a8c]">Failed to load audit events.</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#a89a8c]">No audit events match the current filters.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#231f1b] border-b border-[rgba(200,180,160,0.08)]">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#6b5d52]">
                      <th className="px-4 py-2.5 font-semibold w-[170px]">When</th>
                      <th className="px-4 py-2.5 font-semibold w-[88px]">Actor</th>
                      <th className="px-4 py-2.5 font-semibold">Action</th>
                      <th className="px-4 py-2.5 font-semibold">Resource</th>
                      <th className="px-4 py-2.5 font-semibold w-[110px]">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className="border-b border-[rgba(200,180,160,0.06)] cursor-pointer hover:bg-[rgba(200,180,160,0.04)] transition-colors"
                        data-testid={`row-audit-${row.id}`}
                      >
                        <td className="px-4 py-2.5 text-[#a89a8c] font-mono">{formatDateTime(row.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <ActorTypeBadge kind={row.actorType} />
                        </td>
                        <td className="px-4 py-2.5 text-[#f5f0eb] font-mono">{row.action}</td>
                        <td className="px-4 py-2.5 text-[#a89a8c]">
                          <span className="font-mono">{row.resourceType}</span>
                          {row.resourceId && (
                            <span className="text-[#6b5d52] ml-1.5 font-mono">· {truncate(row.resourceId, 14)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#6b5d52] font-mono">{truncate(row.id, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-[rgba(200,180,160,0.06)]">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className="block w-full text-left px-4 py-3 hover:bg-[rgba(200,180,160,0.04)] transition-colors"
                    data-testid={`row-audit-mobile-${row.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ActorTypeBadge kind={row.actorType} />
                      <span className="text-[13px] text-[#f5f0eb] font-mono truncate">{row.action}</span>
                    </div>
                    <div className="text-[11px] text-[#6b5d52] font-mono">
                      {formatDateTime(row.createdAt)} · {row.resourceType}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination ─────────────────────────────────────────────────── */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px] text-[#6b5d52]">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8 px-2 text-[12px]"
                data-testid="button-audit-prev"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[12px] text-[#a89a8c] self-center px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2 text-[12px]"
                data-testid="button-audit-next"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Detail drawer ─────────────────────────────────────────────────── */}
      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-lg bg-[#1a1714] border-[rgba(200,180,160,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-[#f5f0eb]">Audit Event</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-[13px]">
              <DetailRow label="Action" value={<code className="font-mono text-[12px]">{detail.action}</code>} />
              <DetailRow label="When" value={formatDateTime(detail.createdAt)} />
              <DetailRow label="Actor type" value={<ActorTypeBadge kind={detail.actorType} />} />
              <DetailRow label="Actor ID" value={<code className="font-mono text-[11px] break-all">{detail.actorId || "—"}</code>} />
              <DetailRow label="Resource" value={<code className="font-mono text-[12px]">{detail.resourceType}</code>} />
              <DetailRow label="Resource ID" value={<code className="font-mono text-[11px] break-all">{detail.resourceId || "—"}</code>} />
              <DetailRow label="Request ID" value={<code className="font-mono text-[11px] break-all">{detail.requestId || "—"}</code>} />
              <DetailRow label="Event ID" value={<code className="font-mono text-[11px] break-all">{detail.id}</code>} />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6b5d52] mb-1">Metadata</div>
                <pre className="bg-[#231f1b] border border-[rgba(200,180,160,0.08)] rounded px-3 py-2.5 text-[11px] font-mono text-[#a89a8c] whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">
                  {detail.metadata ? JSON.stringify(detail.metadata, null, 2) : "—"}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#6b5d52]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared subcomponents ──────────────────────────────────────────────────

function ActorTypeBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    user: "bg-[rgba(240,182,94,0.12)] text-[#f0b65e]",
    admin: "bg-[rgba(240,182,94,0.18)] text-[#f0b65e]",
    guest: "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]",
    system: "bg-[rgba(200,180,160,0.06)] text-[#6b5d52]",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${colors[kind] ?? "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]"}`}>
      {kind}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] uppercase tracking-wide text-[#6b5d52] w-[96px] shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 text-[#f5f0eb] min-w-0">{value}</span>
    </div>
  );
}

export function AdminTabs({ current }: { current: "prompts" | "audit" | "llm" }) {
  const tabs: Array<{ id: "prompts" | "audit" | "llm"; href: string; label: string }> = [
    { id: "prompts", href: "/admin", label: "Prompts" },
    { id: "audit", href: "/admin/audit", label: "Audit" },
    { id: "llm", href: "/admin/llm", label: "LLM" },
  ];
  return (
    <nav className="flex items-center gap-1 text-[12px]">
      {tabs.map((tab) => {
        const selected = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`px-2.5 py-1 rounded transition-colors ${
              selected
                ? "text-[#f5f0eb] font-medium"
                : "text-[#a89a8c] hover:text-[#f5f0eb]"
            }`}
            style={
              selected
                ? { borderBottom: "2px solid #f0b65e", borderRadius: 0, paddingBottom: "4px" }
                : undefined
            }
            data-testid={`tab-admin-${tab.id}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
