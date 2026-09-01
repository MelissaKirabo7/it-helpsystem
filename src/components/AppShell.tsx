import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  ShieldCheck,
  Ticket as TicketIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENT_TECH, CURRENT_USER } from "@/lib/tickets";
import { useTickets } from "@/lib/ticket-store";
import { Initials, PriorityTag } from "@/components/ticket-ui";
import type { Role } from "@/lib/tickets";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { to: "/dashboard", label: "Active Queue", icon: LayoutDashboard, roles: ["technician", "admin"] },
  { to: "/", label: "Submit a Request", icon: TicketIcon, roles: ["submitter", "technician", "admin"] },
  { to: "/my-tickets", label: "My Requests", icon: LifeBuoy, roles: ["submitter", "technician", "admin"] },
  { to: "/archive", label: "Archive", icon: Archive, roles: ["technician", "admin"] },
  { to: "/admin", label: "Admin Console", icon: ShieldCheck, roles: ["admin"] },
];

const roleLabels: Record<Role, string> = {
  submitter: "Submitter",
  technician: "Technician",
  admin: "Administrator",
};

export function AppShell({
  title,
  crumb,
  actions,
  children,
}: {
  title: string;
  crumb?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { role, setRole, tickets, active } = useTickets();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return tickets
      .filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.submitter.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, tickets]);

  const visibleNav = nav.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen w-full bg-background p-3 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] gap-0 overflow-hidden rounded-[2rem] bg-card shadow-lift md:min-h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground lg:flex">
          <div>
            <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                <LifeBuoy className="size-5" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">ServeDesk</span>
            </Link>

            <nav className="mt-8 space-y-1">
              {visibleNav.map((item) => {
                const isActive =
                  item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <p className="mt-8 px-3 text-[11px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase">
              Extras
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/75">
                <span className="flex items-center gap-3">
                  <Bell className="size-4" /> Notifications
                </span>
                <span className="rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold text-sidebar-primary-foreground">
                  {active.length}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/75">
                <Settings className="size-4" /> Preferences
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-sidebar-accent p-4">
            <p className="text-[11px] font-semibold tracking-widest text-sidebar-foreground/50 uppercase">
              Viewing as
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Initials
                label={role === "submitter" ? CURRENT_USER.name : CURRENT_TECH.name}
                className="bg-sidebar-primary text-sidebar-primary-foreground"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {role === "submitter" ? CURRENT_USER.name : CURRENT_TECH.name}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[role]}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-1">
              {(["submitter", "technician", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    navigate({ to: r === "submitter" ? "/" : r === "admin" ? "/admin" : "/dashboard" });
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    role === r
                      ? "bg-sidebar text-sidebar-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar/60",
                  )}
                >
                  {roleLabels[r]} view
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-4 md:px-8">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">ServeDesk</span>
              <ChevronRight className="size-3.5" />
              <span className="truncate">{crumb ?? title}</span>
            </div>

            <div className="relative ml-auto w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tickets, people, categories…"
                className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
              />
              {results.length > 0 && (
                <div className="absolute top-12 right-0 left-0 z-30 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
                  {results.map((t) => (
                    <Link
                      key={t.id}
                      to="/tickets/$ticketId"
                      params={{ ticketId: t.id }}
                      onClick={() => setQuery("")}
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <PriorityTag priority={t.priority} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline">
                {roleLabels[role]}
              </span>
              <Initials label={role === "submitter" ? CURRENT_USER.name : CURRENT_TECH.name} />
            </div>
          </header>

          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-6 md:px-8">
            <h1 className="font-display text-2xl font-semibold md:text-3xl">{title}</h1>
            {actions}
          </div>

          <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
