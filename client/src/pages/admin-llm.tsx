import { useMemo, useState } from "react";
import { useLocation } from "wouter";
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
import type { LlmCall } from "@shared/schema";
import { AdminTabs } from "@/pages/admin-audit";

// Types ─────────────────────────────────────────────────────────────────────

type ListResponse = {
  rows: LlmCall[];
  total: number;
};

type Filters = {
  provider: string; // "all" | "anthropic" | "groq" | "openai"
  model: string;
  task: string;
  status: string; // "all" | "ok" | "error"
  projectId: string;
  userId: string;
};

const EMPTY_FILTERS: Filters = {
  provider: "all",
  model: "",
  task: "",
  status: "all",
  projectId: "",
  userId: "",
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

function formatCost(cost: string | null | undefined): string {
  if (cost == null || cost === "") return "—";
  const n = Number(cost);
  if (!Number.isFinite(n)) return cost;
  // Under $0.01 show 6 decimals; else 4.
  return n < 0.01 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}`;
}

function formatTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}

function buildQueryString(filters: Filters, offset: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  if (filters.provider && filters.provider !== "all") params.set("provider", filters.provider);
  if (filters.model) params.set("model", filters.model);
  if (filters.task) params.set("task", filters.task);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.userId) params.set("userId", filters.userId);
  return params.toString();
}

// Page ──────────────────────────────────────────────────────────────────────

export default function AdminLlmPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const offset = page * PAGE_SIZE;
  const queryString = useMemo(() => buildQueryString(filters, offset), [filters, offset]);

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ["/api/admin/llm-calls", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/llm-calls?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: detail } = useQuery<LlmCall>({
    queryKey: ["/api/admin/llm-calls", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/llm-calls/${selectedId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: isAuthenticated && !!selectedId,
  });

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
              <CardTitle className="text-[16px] font-semibold text-[#f5f0eb]">LLM Calls</CardTitle>
              <p className="text-[13px] text-[#a89a8c] mt-1">Sign in to access the admin panel.</p>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Button
                onClick={() => setLocation("/login")}
                className="btn-primary h-9 px-5 text-[13px]"
                data-testid="button-llm-login"
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
    filters.provider !== "all" ||
    filters.model !== "" ||
    filters.task !== "" ||
    filters.status !== "all" ||
    filters.projectId !== "" ||
    filters.userId !== "";

  const totalCostUsd = rows.reduce((acc, r) => acc + (r.costUsd ? Number(r.costUsd) || 0 : 0), 0);
  const totalInTokens = rows.reduce((acc, r) => acc + (r.inputTokens || 0), 0);
  const totalOutTokens = rows.reduce((acc, r) => acc + (r.outputTokens || 0), 0);

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
    draft.provider !== filters.provider ||
    draft.model !== filters.model ||
    draft.task !== filters.task ||
    draft.status !== filters.status ||
    draft.projectId !== filters.projectId ||
    draft.userId !== filters.userId;

  return (
    <div className="min-h-screen" style={{ background: "#110f0d", color: "#f5f0eb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Nav />

      <header className="bg-[#1a1714] border-b border-[rgba(200,180,160,0.08)] sticky top-[56px] z-10 h-[57px]">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#a89a8c] shrink-0" />
            <span className="text-[15px] font-semibold text-[#f5f0eb]">LLM Calls</span>
            <span className="text-[11px] text-[#6b5d52] ml-1">{total.toLocaleString()}</span>
          </div>
          <AdminTabs current="llm" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* Page stats ─────────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Page cost" value={formatCost(String(totalCostUsd))} />
            <StatCard label="Input tokens" value={formatTokens(totalInTokens)} />
            <StatCard label="Output tokens" value={formatTokens(totalOutTokens)} />
          </div>
        )}

        {/* Filters ─────────────────────────────────────────────────────── */}
        <div
          className="border rounded-lg p-3 mb-4"
          style={{ borderColor: "rgba(200,180,160,0.08)", background: "#1a1714" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Provider</label>
              <Select value={draft.provider} onValueChange={(v) => setDraft({ ...draft, provider: v })}>
                <SelectTrigger className="h-8 text-[13px]" data-testid="filter-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Status</label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                <SelectTrigger className="h-8 text-[13px]" data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Model</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="e.g. sonnet-4"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Task</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="e.g. deliverable"
                value={draft.task}
                onChange={(e) => setDraft({ ...draft, task: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">Project ID</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="exact match"
                value={draft.projectId}
                onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6b5d52] mb-1 block uppercase tracking-wide">User ID</label>
              <Input
                className="h-8 text-[13px] font-mono"
                placeholder="exact match"
                value={draft.userId}
                onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
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
            <div className="py-10 text-center text-[13px] text-[#a89a8c]">Failed to load LLM calls.</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#a89a8c]">No LLM calls match the current filters.</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#231f1b] border-b border-[rgba(200,180,160,0.08)]">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#6b5d52]">
                      <th className="px-4 py-2.5 font-semibold w-[170px]">When</th>
                      <th className="px-4 py-2.5 font-semibold w-[90px]">Provider</th>
                      <th className="px-4 py-2.5 font-semibold">Model</th>
                      <th className="px-4 py-2.5 font-semibold">Task</th>
                      <th className="px-4 py-2.5 font-semibold w-[80px]">Status</th>
                      <th className="px-4 py-2.5 font-semibold w-[100px] text-right">Tokens</th>
                      <th className="px-4 py-2.5 font-semibold w-[90px] text-right">Cost</th>
                      <th className="px-4 py-2.5 font-semibold w-[80px] text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className="border-b border-[rgba(200,180,160,0.06)] cursor-pointer hover:bg-[rgba(200,180,160,0.04)] transition-colors"
                        data-testid={`row-llm-${row.id}`}
                      >
                        <td className="px-4 py-2.5 text-[#a89a8c] font-mono">{formatDateTime(row.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <ProviderBadge provider={row.provider} />
                        </td>
                        <td className="px-4 py-2.5 text-[#f5f0eb] font-mono">{truncate(row.model, 24)}</td>
                        <td className="px-4 py-2.5 text-[#a89a8c] font-mono">{row.task}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-2.5 text-[#a89a8c] font-mono text-right">
                          {formatTokens(row.inputTokens)} → {formatTokens(row.outputTokens)}
                        </td>
                        <td className="px-4 py-2.5 text-[#f5f0eb] font-mono text-right">{formatCost(row.costUsd)}</td>
                        <td className="px-4 py-2.5 text-[#a89a8c] font-mono text-right">
                          {row.latencyMs != null ? `${row.latencyMs}ms` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-[rgba(200,180,160,0.06)]">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className="block w-full text-left px-4 py-3 hover:bg-[rgba(200,180,160,0.04)] transition-colors"
                    data-testid={`row-llm-mobile-${row.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ProviderBadge provider={row.provider} />
                      <StatusBadge status={row.status} />
                      <span className="text-[13px] text-[#f5f0eb] font-mono truncate flex-1">{truncate(row.model, 24)}</span>
                    </div>
                    <div className="text-[11px] text-[#6b5d52] font-mono flex items-center justify-between">
                      <span>{formatDateTime(row.createdAt)}</span>
                      <span>
                        {formatTokens(row.inputTokens)} → {formatTokens(row.outputTokens)} · {formatCost(row.costUsd)}
                      </span>
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
                data-testid="button-llm-prev"
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
                data-testid="button-llm-next"
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
            <DialogTitle className="text-[15px] text-[#f5f0eb]">LLM Call</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-[13px]">
              <DetailRow label="When" value={formatDateTime(detail.createdAt)} />
              <DetailRow label="Provider" value={<ProviderBadge provider={detail.provider} />} />
              <DetailRow label="Model" value={<code className="font-mono text-[12px]">{detail.model}</code>} />
              <DetailRow label="Task" value={<code className="font-mono text-[12px]">{detail.task}</code>} />
              <DetailRow label="Status" value={<StatusBadge status={detail.status} />} />
              {detail.errorCode && (
                <DetailRow label="Error" value={<code className="font-mono text-[12px] text-[#e07070]">{detail.errorCode}</code>} />
              )}
              <DetailRow
                label="Tokens"
                value={
                  <span className="font-mono text-[12px]">
                    in {formatTokens(detail.inputTokens)} · out {formatTokens(detail.outputTokens)}
                    {detail.cacheReadTokens != null && <> · cache-read {formatTokens(detail.cacheReadTokens)}</>}
                    {detail.cacheWriteTokens != null && <> · cache-write {formatTokens(detail.cacheWriteTokens)}</>}
                  </span>
                }
              />
              <DetailRow label="Cost" value={<span className="font-mono text-[12px]">{formatCost(detail.costUsd)}</span>} />
              <DetailRow label="Latency" value={<span className="font-mono text-[12px]">{detail.latencyMs != null ? `${detail.latencyMs} ms` : "—"}</span>} />
              <DetailRow label="Streamed" value={<span className="text-[12px]">{detail.streamed ? "Yes" : "No"}</span>} />
              <DetailRow label="BYOK" value={<span className="text-[12px]">{detail.byok ? "Yes" : "No"}</span>} />
              <DetailRow label="User ID" value={<code className="font-mono text-[11px] break-all">{detail.userId || "—"}</code>} />
              <DetailRow label="Guest owner ID" value={<code className="font-mono text-[11px] break-all">{detail.guestOwnerId || "—"}</code>} />
              <DetailRow label="Project ID" value={<code className="font-mono text-[11px] break-all">{detail.projectId || "—"}</code>} />
              <DetailRow label="Stage ID" value={<code className="font-mono text-[11px] break-all">{detail.stageId || "—"}</code>} />
              <DetailRow label="Request ID" value={<code className="font-mono text-[11px] break-all">{detail.requestId || "—"}</code>} />
              <DetailRow label="Call ID" value={<code className="font-mono text-[11px] break-all">{detail.id}</code>} />
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

// Shared subcomponents ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="border rounded-lg px-3 py-2.5"
      style={{ borderColor: "rgba(200,180,160,0.08)", background: "#1a1714" }}
    >
      <div className="text-[11px] uppercase tracking-wide text-[#6b5d52] mb-0.5">{label}</div>
      <div className="text-[15px] text-[#f5f0eb] font-mono">{value}</div>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    anthropic: "bg-[rgba(240,182,94,0.12)] text-[#f0b65e]",
    groq: "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]",
    openai: "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${colors[provider] ?? "bg-[rgba(200,180,160,0.08)] text-[#a89a8c]"}`}>
      {provider}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isOk = status === "ok";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
        isOk ? "bg-[rgba(74,222,128,0.10)] text-green-400" : "bg-[rgba(224,112,112,0.12)] text-[#e07070]"
      }`}
    >
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] uppercase tracking-wide text-[#6b5d52] w-[110px] shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 text-[#f5f0eb] min-w-0">{value}</span>
    </div>
  );
}
