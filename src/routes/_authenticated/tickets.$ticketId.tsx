import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, EyeOff, Globe, Lock, MapPin, Monitor, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Initials, PriorityTag, SlaMeter, StatusBadge } from "@/components/ticket-ui";
import { useTickets } from "@/lib/ticket-store";
import {
  STATUSES,
  TECHNICIANS,
  relativeTime,
  techName,
  type NoteVisibility,
  type Status,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tickets/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket detail — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Full ticket workspace: assignment, status lifecycle, SLA timer, internal work log and public updates for the submitter.",
      },
      { property: "og:title", content: "Ticket detail — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Work an IT ticket end to end with internal notes, public replies and resolution notes.",
      },
    ],
  }),
  component: TicketDetail,
});

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const { tickets, role, assign, setStatus, addNote, resolve } = useTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  const isStaff = role !== "submitter";

  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("internal");
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolveError, setResolveError] = useState("");

  if (!ticket) {
    return (
      <AppShell title="Ticket not found" crumb="Tickets">
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No ticket matches <span className="font-mono">{ticketId}</span>.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to active queue
          </Link>
        </div>
      </AppShell>
    );
  }

  const visibleNotes = ticket.notes.filter((n) => isStaff || n.visibility === "public");

  const timeline = [
    ...ticket.events.map((e) => ({ id: e.id, at: e.at, kind: "event" as const, label: e.label })),
    ...visibleNotes.map((n) => ({ id: n.id, at: n.at, kind: "note" as const, note: n })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  function submitResolution() {
    if (resolution.trim().length < 15) {
      setResolveError("Resolution notes are mandatory — describe the fix in at least 15 characters.");
      return;
    }
    resolve(ticket!.id, resolution);
    setResolveError("");
    setResolving(false);
    setResolution("");
  }

  return (
    <AppShell title={ticket.title} crumb={`Tickets · ${ticket.id}`}>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
              <StatusBadge status={ticket.status} />
              <PriorityTag priority={ticket.priority} />
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ticket.category}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                opened {relativeTime(ticket.createdAt)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">{ticket.description}</p>

            <dl className="mt-6 grid gap-4 border-t border-border/70 pt-5 text-sm sm:grid-cols-3">
              <Meta icon={User} label="Submitter" value={`${ticket.submitter} · ${ticket.department}`} />
              <Meta icon={MapPin} label="Location" value={ticket.room} />
              <Meta icon={Monitor} label="Workstation" value={ticket.workstation} />
            </dl>

            {ticket.resolutionNotes && (
              <div className="mt-5 rounded-2xl bg-status-resolved-soft p-4">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-status-resolved uppercase">
                  <CheckCircle2 className="size-4" /> Resolution notes
                </p>
                <p className="mt-2 text-sm text-status-resolved">{ticket.resolutionNotes}</p>
              </div>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Activity timeline</h2>
            <ol className="mt-5 space-y-5 border-l border-border pl-5">
              {timeline.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.42rem] size-2.5 rounded-full bg-primary/40" />
                  {item.kind === "event" ? (
                    <div>
                      <p className="text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(item.at)}</p>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        item.note.visibility === "internal"
                          ? "border-dashed border-prio-medium/40 bg-prio-medium/6"
                          : "border-border bg-surface",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">{item.note.author}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                            item.note.visibility === "internal"
                              ? "bg-prio-medium/15 text-prio-medium"
                              : "bg-status-new-soft text-status-new",
                          )}
                        >
                          {item.note.visibility === "internal" ? (
                            <>
                              <Lock className="size-3" /> Internal note
                            </>
                          ) : (
                            <>
                              <Globe className="size-3" /> Public update
                            </>
                          )}
                        </span>
                        <span className="text-muted-foreground">{relativeTime(item.note.at)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{item.note.body}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {isStaff && ticket.status !== "Resolved" && (
              <div className="mt-6 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap gap-2">
                  {(["internal", "public"] as NoteVisibility[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        visibility === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {v === "internal" ? <EyeOff className="size-3.5" /> : <Globe className="size-3.5" />}
                      {v === "internal" ? "Internal work log" : "Reply to submitter"}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder={
                    visibility === "internal"
                      ? "Visible to the IT department only…"
                      : "This text is emailed to the submitter…"
                  }
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
                />
                <button
                  disabled={note.trim().length < 3}
                  onClick={() => {
                    addNote(ticket.id, note, visibility);
                    setNote("");
                  }}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Add {visibility === "internal" ? "note" : "response"}
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">SLA</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              First-response target derived from the priority matrix.
            </p>
            <div className="mt-4">
              <SlaMeter ticket={ticket} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Due {new Date(ticket.updatedAt).toLocaleString()}
            </p>
          </section>

          {isStaff && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Workflow</h2>

              <label className="mt-4 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Assignee
              </label>
              <select
                value={ticket.assigneeId ?? ""}
                onChange={(e) => assign(ticket.id, e.target.value || null)}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/15"
              >
                <option value="">Unassigned</option>
                {TECHNICIANS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.team}
                  </option>
                ))}
              </select>

              <label className="mt-5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Status
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => (s === "Resolved" ? setResolving(true) : setStatus(ticket.id, s as Status))}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                      ticket.status === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {resolving && (
                <div className="mt-4 rounded-2xl border border-status-resolved/30 bg-status-resolved-soft p-4">
                  <p className="text-sm font-semibold text-status-resolved">
                    Resolution notes are required
                  </p>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={4}
                    placeholder="Explain the fix applied — this is emailed to the submitter and kept for audit."
                    className="mt-3 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/15"
                  />
                  {resolveError && (
                    <p className="mt-2 text-xs font-medium text-destructive">{resolveError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={submitResolution}
                      className="rounded-full bg-status-resolved px-4 py-2 text-sm font-semibold text-card"
                    >
                      Resolve &amp; archive
                    </button>
                    <button
                      onClick={() => setResolving(false)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {ticket.status === "Resolved" && (
                <p className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  This ticket left the active queue and now lives in the read-only archive.
                </p>
              )}
            </section>
          )}

          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Handling</h2>
            <div className="mt-4 flex items-center gap-3">
              <Initials label={techName(ticket.assigneeId) ?? "Un assigned"} />
              <div>
                <p className="text-sm font-medium">{techName(ticket.assigneeId) ?? "Unassigned"}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.assigneeId
                    ? TECHNICIANS.find((t) => t.id === ticket.assigneeId)?.team
                    : "Waiting on triage"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last activity {relativeTime(ticket.updatedAt)}
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
