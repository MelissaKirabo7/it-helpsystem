import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, Filter, Inbox } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Initials, PriorityTag, SlaMeter, StatCard, StatusBadge } from "@/components/ticket-ui";
import { useTickets } from "@/lib/ticket-store";
import {
  CATEGORIES,
  CURRENT_TECH,
  PRIORITIES,
  STATUSES,
  relativeTime,
  slaState,
  techName,
  type Category,
  type Priority,
  type Status,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Active Ticket Queue — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Technician workspace: triage open IT tickets, claim work, track SLA timers and clear resolved tickets from the active queue.",
      },
      { property: "og:title", content: "Active Ticket Queue — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Live IT queue with quick filters for assigned, unassigned and overdue SLA tickets.",
      },
    ],
  }),
  component: DashboardPage,
});

type Quick = "all" | "mine" | "unassigned" | "overdue";

const quickFilters: { key: Quick; label: string }[] = [
  { key: "all", label: "All active" },
  { key: "mine", label: "Assigned to me" },
  { key: "unassigned", label: "Unassigned" },
  { key: "overdue", label: "Overdue SLAs" },
];

function DashboardPage() {
  const { active, assign } = useTickets();
  const [quick, setQuick] = useState<Quick>("all");
  const [status, setStatus] = useState<Status | "any">("any");
  const [priority, setPriority] = useState<Priority | "any">("any");
  const [category, setCategory] = useState<Category | "any">("any");
  const [sort, setSort] = useState<"newest" | "priority">("newest");

  const prioRank: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  const rows = useMemo(() => {
    let list = active.filter((t) => {
      if (quick === "mine" && t.assigneeId !== CURRENT_TECH.id) return false;
      if (quick === "unassigned" && t.assigneeId) return false;
      if (quick === "overdue" && !slaState(t).overdue) return false;
      if (status !== "any" && t.status !== status) return false;
      if (priority !== "any" && t.priority !== priority) return false;
      if (category !== "any" && t.category !== category) return false;
      return true;
    });
    list = [...list].sort((a, b) =>
      sort === "priority"
        ? prioRank[a.priority] - prioRank[b.priority]
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return list;
  }, [active, quick, status, priority, category, sort]);

  const overdue = active.filter((t) => slaState(t).overdue).length;

  return (
    <AppShell
      title="Active queue"
      crumb="IT dashboard"
      actions={
        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 text-xs font-medium">
          {(["newest", "priority"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn(
                "rounded-full px-3 py-1.5 capitalize transition-colors",
                sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {s === "newest" ? "Newest first" : "By priority"}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tickets" value={active.length} hint="Resolved tickets auto-archive" tone="accent" />
        <StatCard
          label="Unassigned"
          value={active.filter((t) => !t.assigneeId).length}
          hint="Waiting on triage"
        />
        <StatCard
          label="In progress"
          value={active.filter((t) => t.status === "In Progress").length}
          hint="Being worked right now"
        />
        <StatCard label="Overdue SLAs" value={overdue} hint="Past first-response target" tone="danger" />
      </div>

      <div className="panel mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setQuick(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  quick === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={status} onChange={(v) => setStatus(v as Status | "any")} options={["any", ...STATUSES]} />
            <Select
              value={priority}
              onChange={(v) => setPriority(v as Priority | "any")}
              options={["any", ...PRIORITIES]}
            />
            <Select
              value={category}
              onChange={(v) => setCategory(v as Category | "any")}
              options={["any", ...CATEGORIES]}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">Ticket</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Priority</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Assignee</th>
                <th className="px-3 py-3 font-medium">SLA</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-muted/60">
                  <td className="px-5 py-4">
                    <Link
                      to="/tickets/$ticketId"
                      params={{ ticketId: t.id }}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono whitespace-nowrap">{t.id}</span>· {t.submitter} · {t.room} ·{" "}
                      {relativeTime(t.createdAt)}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">{t.category}</td>
                  <td className="px-3 py-4">
                    <PriorityTag priority={t.priority} />
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-4">
                    {t.assigneeId ? (
                      <span className="flex items-center gap-2">
                        <Initials label={techName(t.assigneeId)!} className="size-7" />
                        <span className="text-xs">{techName(t.assigneeId)}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => assign(t.id, CURRENT_TECH.id)}
                        className="rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/8"
                      >
                        Claim
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <SlaMeter ticket={t} compact />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to="/tickets/$ticketId"
                      params={{ ticketId: t.id }}
                      className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
                      aria-label={`Open ${t.id}`}
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Inbox className="size-8 text-muted-foreground" />
              <p className="font-medium">Nothing in this view</p>
              <p className="text-sm text-muted-foreground">
                Resolved tickets leave the active queue automatically — check the archive.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-full border border-border bg-card px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/15"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "any" ? "Any" : o}
        </option>
      ))}
    </select>
  );
}
