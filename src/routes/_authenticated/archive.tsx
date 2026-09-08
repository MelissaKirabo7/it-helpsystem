import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PriorityTag, StatCard } from "@/components/ticket-ui";
import { useTickets } from "@/lib/ticket-store";
import { CATEGORIES, relativeTime, techName, type Category } from "@/lib/tickets";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Resolved Ticket Archive — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Read-only historical archive of resolved IT tickets with resolution notes, average resolution time and 12-month retention.",
      },
      { property: "og:title", content: "Resolved Ticket Archive — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Audit resolved tickets and reporting metrics after they leave the active queue.",
      },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { archive } = useTickets();
  const [category, setCategory] = useState<Category | "any">("any");

  const rows = useMemo(
    () =>
      archive
        .filter((t) => category === "any" || t.category === category)
        .sort((a, b) => new Date(b.resolvedAt ?? 0).getTime() - new Date(a.resolvedAt ?? 0).getTime()),
    [archive, category],
  );

  const avgHours = useMemo(() => {
    const done = archive.filter((t) => t.resolvedAt);
    if (done.length === 0) return "—";
    const total = done.reduce(
      (sum, t) => sum + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()),
      0,
    );
    return `${(total / done.length / 3600_000).toFixed(1)}h`;
  }, [archive]);

  return (
    <AppShell
      title="Historical archive"
      crumb="Archive"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3.5" /> Read-only · 12-month retention
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Archived tickets" value={archive.length} hint="Cleared from active queue" tone="accent" />
        <StatCard label="Avg. resolution time" value={avgHours} hint="Submission to resolution" />
        <StatCard
          label="Resolved this week"
          value={
            archive.filter(
              (t) => t.resolvedAt && Date.now() - new Date(t.resolvedAt).getTime() < 7 * 864e5,
            ).length
          }
          hint="Rolling 7 days"
        />
      </div>

      <div className="panel mt-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold">Resolved log</h2>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "any")}
            className="ml-auto h-9 rounded-full border border-border bg-card px-3 text-xs font-medium outline-none"
          >
            {(["any", ...CATEGORIES] as const).map((c) => (
              <option key={c} value={c}>
                {c === "any" ? "All categories" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((t) => (
            <Link
              key={t.id}
              to="/tickets/$ticketId"
              params={{ ticketId: t.id }}
              className="block rounded-2xl border border-border p-4 transition-colors hover:bg-muted/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                <span className="font-medium">{t.title}</span>
                <PriorityTag priority={t.priority} />
                <span className="ml-auto text-xs text-muted-foreground">
                  resolved {relativeTime(t.resolvedAt ?? t.updatedAt)} by{" "}
                  {techName(t.assigneeId) ?? "IT"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.resolutionNotes}</p>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No archived tickets in this category yet.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
