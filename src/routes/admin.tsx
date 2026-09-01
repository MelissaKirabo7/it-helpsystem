import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Initials, StatCard } from "@/components/ticket-ui";
import { useTickets } from "@/lib/ticket-store";
import { CATEGORIES, PRIORITIES, SLA_HOURS, TECHNICIANS, slaState } from "@/lib/tickets";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Administrator dashboard for IT ticketing: volume by category, technician workload, SLA targets, department routing and access controls.",
      },
      { property: "og:title", content: "Admin Console — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Manage routing, roles and SLA policy while monitoring IT ticket throughput.",
      },
    ],
  }),
  component: AdminPage,
});

const routing = [
  { department: "Finance", queue: "Endpoint Support", escalation: "Joy Ezechukwu" },
  { department: "Sales", queue: "Network Ops", escalation: "Daniel Okafor" },
  { department: "HR", queue: "Identity & Access", escalation: "Marko Dorasław" },
  { department: "Facilities", queue: "Endpoint Support", escalation: "Emily Carter" },
];

function AdminPage() {
  const { tickets, active, archive } = useTickets();

  const byCategory = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        name: c.replace("/Wi-Fi", ""),
        tickets: tickets.filter((t) => t.category === c).length,
      })),
    [tickets],
  );

  const byPriority = useMemo(
    () => PRIORITIES.map((p) => ({ name: p, value: tickets.filter((t) => t.priority === p).length })),
    [tickets],
  );

  const pieColors = [
    "var(--color-prio-low)",
    "var(--color-prio-medium)",
    "var(--color-prio-high)",
    "var(--color-prio-critical)",
  ];

  return (
    <AppShell title="Admin console" crumb="Administration">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tickets" value={tickets.length} hint="All time" tone="accent" />
        <StatCard label="Active" value={active.length} hint="Open work" />
        <StatCard label="Archived" value={archive.length} hint="Resolved & retained" />
        <StatCard
          label="SLA breaches"
          value={active.filter((t) => slaState(t).overdue).length}
          hint="Needs escalation"
          tone="danger"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Volume by category</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                  }}
                />
                <Bar dataKey="tickets" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Priority mix</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byPriority} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}>
                  {byPriority.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {byPriority.map((p, i) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: pieColors[i] }} />
                {p.name} · {p.value}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Technician workload</h2>
          <div className="mt-4 space-y-3">
            {TECHNICIANS.map((tech) => {
              const load = active.filter((t) => t.assigneeId === tech.id).length;
              return (
                <div key={tech.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <Initials label={tech.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tech.name}</p>
                    <p className="text-xs text-muted-foreground">{tech.team}</p>
                  </div>
                  <div className="w-28">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, load * 33)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {load} active
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Department routing &amp; access</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium">Default queue</th>
                <th className="pb-2 font-medium">Escalation</th>
              </tr>
            </thead>
            <tbody>
              {routing.map((r) => (
                <tr key={r.department} className="border-t border-border/60">
                  <td className="py-2.5 font-medium">{r.department}</td>
                  <td className="py-2.5 text-muted-foreground">{r.queue}</td>
                  <td className="py-2.5 text-muted-foreground">{r.escalation}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-6 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            SLA policy
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {PRIORITIES.map((p) => (
              <li key={p} className="rounded-xl bg-surface px-3 py-2">
                <span className="font-medium">{p}</span>
                <span className="ml-2 text-muted-foreground">{SLA_HOURS[p]}h first response</span>
              </li>
            ))}
          </ul>

          <p className="mt-5 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            RBAC: submitters only see their own tickets, technicians see the full active queue and
            internal notes, admins additionally manage routing, roles and retention.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
