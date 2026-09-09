import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PriorityTag, SlaMeter, StatusBadge } from "@/components/ticket-ui";
import { useAuth } from "@/lib/auth";
import { useTickets } from "@/lib/ticket-store";
import { relativeTime } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/my-tickets")({
  head: () => ({
    meta: [
      { title: "My IT Requests — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Track every IT request you submitted, its current status, priority and the public updates left by the support team.",
      },
      { property: "og:title", content: "My IT Requests — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "A personal view of the tickets you authored — other people's tickets stay private.",
      },
    ],
  }),
  component: MyTickets,
});

function MyTickets() {
  const { user } = useAuth();
  const { tickets, isLoading } = useTickets();
  // Always scoped to the signed-in account, technicians and admins included.
  const mine = tickets
    .filter((t) => t.submitterId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppShell
      title="My requests"
      crumb="Submitter portal · My requests"
      actions={
        <Link
          to="/"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          New request
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {mine.map((t) => (
          <Link
            key={t.id}
            to="/tickets/$ticketId"
            params={{ ticketId: t.id }}
            className="panel p-5 transition-shadow hover:shadow-lift"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{t.ref}</span>
              <StatusBadge status={t.status} />
            </div>
            <p className="mt-3 font-display text-base font-semibold">{t.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
            <div className="mt-4 flex items-center gap-3">
              <PriorityTag priority={t.priority} />
              <span className="text-xs text-muted-foreground">{t.category}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {relativeTime(t.createdAt)}
              </span>
            </div>
            {t.status !== "Resolved" && (
              <div className="mt-4">
                <SlaMeter ticket={t} compact />
              </div>
            )}
          </Link>
        ))}
        {!isLoading && mine.length === 0 && (
          <p className="text-sm text-muted-foreground">You have not submitted any requests yet.</p>
        )}
      </div>
    </AppShell>
  );
}
