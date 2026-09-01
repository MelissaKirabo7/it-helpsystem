import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { PriorityTag, StatusBadge } from "@/components/ticket-ui";
import { useTickets } from "@/lib/ticket-store";
import {
  CATEGORIES,
  CURRENT_USER,
  PRIORITIES,
  SLA_HOURS,
  relativeTime,
  type Category,
  type Priority,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Log an IT Request — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Submit an IT issue from your workstation in three clicks: pick a category, describe the problem, and track the ticket to resolution.",
      },
      { property: "og:title", content: "Log an IT Request — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Self-service IT ticket submission with instant ticket ID and live status tracking.",
      },
    ],
  }),
  component: SubmitPage,
});

const schema = z.object({
  title: z.string().trim().min(6, "Give a short summary of at least 6 characters").max(120),
  description: z.string().trim().min(20, "Describe the issue in at least 20 characters").max(2000),
  room: z.string().trim().min(2, "Room / location is required").max(80),
});

function SubmitPage() {
  const { createTicket, tickets } = useTickets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [room, setRoom] = useState(CURRENT_USER.room);
  const [category, setCategory] = useState<Category>("Hardware");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<string | null>(null);

  const mine = tickets.filter((t) => t.submitterEmail === CURRENT_USER.email).slice(0, 3);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ title, description, room });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    const ticket = createTicket({ ...parsed.data, category, priority });
    setCreated(ticket.id);
    setTitle("");
    setDescription("");
  }

  return (
    <AppShell title="Log an IT request" crumb="Submitter portal">
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <form onSubmit={submit} className="panel p-6 md:p-7">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              Identity auto-filled from directory sign-in
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium">{CURRENT_USER.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{CURRENT_USER.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Workstation</dt>
                <dd className="font-medium">{CURRENT_USER.workstation}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Summary" error={errors.title} hint="One line an IT technician can scan.">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. Laptop will not power on"
                className={inputCls}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Room / location" error={errors.room}>
                <input value={room} onChange={(e) => setRoom(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Urgency" hint={`Target first response: ${SLA_HOURS[priority]}h`}>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                      priority === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="What is happening?" error={errors.description}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Include what you tried, any error text, and when it started."
                className={cn(inputCls, "h-auto resize-y py-3")}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Send className="size-4" /> Submit ticket
            </button>
            <p className="text-xs text-muted-foreground">
              You will get an on-screen confirmation and a ticket ID by email.
            </p>
          </div>

          {created && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-status-resolved-soft p-4 text-sm text-status-resolved">
              <CheckCircle2 className="size-5" />
              <span className="font-medium">
                Ticket {created} created. A confirmation email is on its way.
              </span>
              <Link
                to="/tickets/$ticketId"
                params={{ ticketId: created }}
                className="ml-auto rounded-full bg-status-resolved px-3 py-1.5 text-xs font-semibold text-card"
              >
                View ticket
              </Link>
            </div>
          )}
        </form>

        <div className="space-y-5">
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Your recent requests</h2>
            <div className="mt-4 space-y-3">
              {mine.length === 0 && (
                <p className="text-sm text-muted-foreground">You have no requests yet.</p>
              )}
              {mine.map((t) => (
                <Link
                  key={t.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="block rounded-2xl border border-border p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium">{t.title}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <PriorityTag priority={t.priority} />
                    <Clock className="size-3.5" /> {relativeTime(t.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/my-tickets"
              className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              See all my requests
            </Link>
          </section>

          <section className="panel bg-primary p-6 text-primary-foreground">
            <h2 className="font-display text-lg font-semibold">How resolution works</h2>
            <ol className="mt-4 space-y-3 text-sm text-primary-foreground/80">
              {[
                "You submit the form — the ticket lands in the IT active queue.",
                "A technician claims it and moves it to In Progress.",
                "You see public updates on the ticket timeline.",
                "On resolution you get an email with the fix applied.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
