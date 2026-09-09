import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useNotifications, useTickets } from "@/lib/ticket-store";
import { Initials, PriorityTag } from "@/components/ticket-ui";
import { relativeTime, type Role } from "@/lib/tickets";

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
  const { role, profile, user, signOut } = useAuth();
  const { tickets } = useTickets();
  const notifications = useNotifications();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);

  const displayName = profile?.full_name || user?.email || "Signed in";

  // Search runs over tickets the database already scoped to this account,
  // so submitters can only ever match their own requests.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return tickets
      .filter(
        (t) =>
          t.ref.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.submitter.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, tickets]);

  const visibleNav = nav.filter((item) => item.roles.includes(role));

  const sidebar = (
    <div className="flex h-full flex-col justify-between bg-sidebar p-5 text-sidebar-foreground">
      <div>
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 px-1">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <LifeBuoy className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">ServeDesk</span>
          </Link>
          <button
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-sidebar-foreground/70 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {visibleNav.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
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
      </div>

      <div className="rounded-2xl bg-sidebar-accent p-4">
        <p className="text-[11px] font-semibold tracking-widest text-sidebar-foreground/50 uppercase">
          Signed in as
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Initials
            label={displayName}
            className="bg-sidebar-primary text-sidebar-primary-foreground"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[role]}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut();
            void navigate({ to: "/auth" });
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar/60 px-3 py-2 text-xs font-semibold text-sidebar-foreground hover:bg-sidebar"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background p-3 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] gap-0 overflow-hidden rounded-[2rem] bg-card shadow-lift md:min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close menu overlay"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-foreground/40"
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-lift">{sidebar}</div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-4 md:px-8">
            <button
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card lg:hidden"
            >
              <Menu className="size-4" />
            </button>

            <div className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <span className="font-medium text-foreground">ServeDesk</span>
              <ChevronRight className="size-3.5" />
              <span className="truncate">{crumb ?? title}</span>
            </div>

            <div className="relative ml-auto w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your tickets…"
                className="h-10 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
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
                      <span className="font-mono text-xs text-muted-foreground">{t.ref}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <PriorityTag priority={t.priority} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              <button
                onClick={() => {
                  setBell((v) => !v);
                  if (!bell && notifications.unread > 0) notifications.markAllRead.mutate();
                }}
                aria-label="Notifications"
                className="relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted"
              >
                <Bell className="size-4" />
                {notifications.unread > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-card">
                    {notifications.unread}
                  </span>
                )}
              </button>
              <Initials label={displayName} />

              {bell && (
                <div className="absolute top-11 right-0 z-40 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
                  <p className="border-b border-border/70 px-4 py-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Notifications
                  </p>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.items.length === 0 && (
                      <p className="px-4 py-6 text-sm text-muted-foreground">
                        Nothing yet — updates on your tickets appear here.
                      </p>
                    )}
                    {notifications.items.map((n) => (
                      <Link
                        key={n.id}
                        to="/tickets/$ticketId"
                        params={{ ticketId: n.ticket_id ?? "" }}
                        onClick={() => setBell(false)}
                        className="block px-4 py-3 text-sm hover:bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{n.title}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                            {n.ticket_ref}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {relativeTime(n.created_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 md:px-8">
            <h1 className="font-display text-2xl font-semibold md:text-3xl">{title}</h1>
            {actions}
          </div>

          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
