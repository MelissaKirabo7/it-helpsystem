import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  EyeOff,
  Globe,
  Lock,
  MapPin,
  Monitor,
  RotateCcw,
  User,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { ScreenshotInput } from "@/components/ScreenshotInput";
import { Initials, PriorityTag, SlaMeter, StatusBadge } from "@/components/ticket-ui";
import { useAuth } from "@/lib/auth";
import { useStaff, useTicket, useTicketActions } from "@/lib/ticket-store";
import {
  ACTIVE_STATUSES,
  REOPEN_WINDOW_DAYS,
  relativeTime,
  reopenWindow,
  type NoteVisibility,
  type Status,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tickets/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket detail — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Full ticket workspace: assignment, status lifecycle, SLA timer, screenshots, internal work log and public updates for the submitter.",
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
  const { user, isStaff } = useAuth();
  const { data, isLoading } = useTicket(ticketId);
  const { data: staff } = useStaff();
  const { assign, setStatus, addNote, resolve, reopen } = useTicketActions();

  const [note, setNote] = useState("");
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<NoteVisibility>(isStaff ? "internal" : "public");
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolveError, setResolveError] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <AppShell title="Loading ticket…" crumb="Tickets">
        <div className="panel h-64 animate-pulse" />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Ticket not found" crumb="Tickets">
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No ticket matches this link, or you do not have access to it.
          </p>
          <Link
            to="/my-tickets"
            className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to my requests
          </Link>
        </div>
      </AppShell>
    );
  }

  const { ticket, notes, events, attachments } = data;
  const isAuthor = ticket.submitterId === user?.id;
  const reopenState = reopenWindow(ticket);
  const ticketFiles = attachments.filter((a) => !a.noteId);

  const timeline = [
    ...events.map((e) => ({ id: e.id, at: e.at, kind: "event" as const, label: e.label })),
    ...notes.map((n) => ({ id: n.id, at: n.at, kind: "note" as const, note: n })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  async function submitNote() {
    setError("");
    try {
      await addNote.mutateAsync({
        ticketId: ticket.id,
        body: note,
        visibility: isStaff ? visibility : "public",
        files: noteFiles,
      });
      setNote("");
      setNoteFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the update");
    }
  }

  async function submitResolution() {
    if (resolution.trim().length < 15) {
      setResolveError("Resolution notes are mandatory — describe the fix in at least 15 characters.");
      return;
    }
    await resolve.mutateAsync({ ticketId: ticket.id, notes: resolution });
    setResolveError("");
    setResolving(false);
    setResolution("");
  }

  return (
    <AppShell title={ticket.title} crumb={`Tickets · ${ticket.ref}`}>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.ref}</span>
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
            <AttachmentGallery items={ticketFiles} />

            <dl className="mt-6 grid gap-4 border-t border-border/70 pt-5 text-sm sm:grid-cols-3">
              <Meta icon={User} label="Submitter" value={`${ticket.submitter} · ${ticket.department}`} />
              <Meta icon={MapPin} label="Location" value={ticket.room || "—"} />
              <Meta icon={Monitor} label="Workstation" value={ticket.workstation || "—"} />
            </dl>

            {ticket.resolutionNotes && (
              <div className="mt-5 rounded-2xl bg-status-resolved-soft p-4">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-status-resolved uppercase">
                  <CheckCircle2 className="size-4" /> Resolution notes
                </p>
                <p className="mt-2 text-sm text-status-resolved">{ticket.resolutionNotes}</p>
              </div>
            )}

            {isAuthor && ticket.status === "Resolved" && (
              <div className="mt-5 rounded-2xl border border-border p-4">
                {reopenState.open ? (
                  reopenOpen ? (
                    <div>
                      <p className="text-sm font-semibold">Why does this need more work?</p>
                      <textarea
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        rows={3}
                        className="mt-2 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/15"
                        placeholder="The problem came back this morning…"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            setError("");
                            try {
                              await reopen.mutateAsync({
                                ticketId: ticket.id,
                                reason: reopenReason,
                              });
                              setReopenOpen(false);
                              setReopenReason("");
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Could not reopen");
                            }
                          }}
                          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                        >
                          Reopen ticket
                        </button>
                        <button
                          onClick={() => setReopenOpen(false)}
                          className="rounded-full border border-border px-4 py-2 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReopenOpen(true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                    >
                      <RotateCcw className="size-4" /> Reopen this ticket —{" "}
                      {reopenState.daysLeft} day{reopenState.daysLeft === 1 ? "" : "s"} left
                    </button>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The {REOPEN_WINDOW_DAYS}-day reopen window has closed. Please submit a new
                    request if the issue returns.
                  </p>
                )}
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
                      <AttachmentGallery
                        items={attachments.filter((a) => a.noteId === item.note.id)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {(isStaff || isAuthor) && ticket.status !== "Resolved" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitNote();
                }}
                className="mt-6 rounded-2xl border border-border p-4"
              >
                {isStaff && (
                  <div className="flex flex-wrap gap-2">
                    {(["internal", "public"] as NoteVisibility[]).map((v) => (
                      <button
                        key={v}
                        type="button"
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
                )}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder={
                    !isStaff
                      ? "Add more context for the IT team — paste a screenshot with Ctrl/Cmd + V…"
                      : visibility === "internal"
                        ? "Visible to the IT department only…"
                        : "This update is shown to the submitter…"
                  }
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
                />
                <div className="mt-3">
                  <ScreenshotInput files={noteFiles} onChange={setNoteFiles} label="Attach screenshot" />
                </div>
                {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={note.trim().length < 3 || addNote.isPending}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {isStaff && visibility === "internal" ? "Add note" : "Post reply"}
                </button>
              </form>
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
              Last activity {relativeTime(ticket.updatedAt)}
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
                onChange={(e) => {
                  const id = e.target.value || null;
                  assign.mutate({
                    ticketId: ticket.id,
                    assigneeId: id,
                    assigneeName: staff?.find((s) => s.id === id)?.name ?? null,
                  });
                }}
                className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/15"
              >
                <option value="">Unassigned</option>
                {(staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <label className="mt-5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Status
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[...ACTIVE_STATUSES, "Resolved"].map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      s === "Resolved"
                        ? setResolving(true)
                        : setStatus.mutate({ ticketId: ticket.id, status: s as Status })
                    }
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
                    placeholder="Explain the fix applied — the submitter is notified and this is kept for audit."
                    className="mt-3 w-full resize-y rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/15"
                  />
                  {resolveError && (
                    <p className="mt-2 text-xs font-medium text-destructive">{resolveError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void submitResolution()}
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
              <Initials label={ticket.assigneeName ?? "Un assigned"} />
              <div>
                <p className="text-sm font-medium">{ticket.assigneeName ?? "Unassigned"}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.assigneeId ? "IT support" : "Waiting on triage"}
                </p>
              </div>
            </div>
            {ticket.reopenedCount > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Reopened {ticket.reopenedCount} time{ticket.reopenedCount === 1 ? "" : "s"} by the
                submitter.
              </p>
            )}
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
