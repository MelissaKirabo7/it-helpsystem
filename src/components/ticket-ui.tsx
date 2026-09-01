import { cn } from "@/lib/utils";
import { slaState, type Priority, type Status, type Ticket } from "@/lib/tickets";

const statusStyles: Record<Status, string> = {
  New: "bg-status-new-soft text-status-new",
  "In Progress": "bg-status-progress-soft text-status-progress",
  Pending: "bg-status-pending-soft text-status-pending",
  Resolved: "bg-status-resolved-soft text-status-resolved",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const prioStyles: Record<Priority, string> = {
  Low: "border-prio-low/30 text-prio-low",
  Medium: "border-prio-medium/40 text-prio-medium",
  High: "border-prio-high/40 text-prio-high",
  Critical: "border-prio-critical/50 text-prio-critical bg-prio-critical/8",
};

export function PriorityTag({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase",
        prioStyles[priority],
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function SlaMeter({ ticket, compact }: { ticket: Ticket; compact?: boolean }) {
  const sla = slaState(ticket);
  return (
    <div className={cn("min-w-24", compact ? "space-y-1" : "space-y-1.5")}>
      <div
        className={cn(
          "text-xs font-medium",
          sla.overdue ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {sla.label}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            sla.overdue
              ? "bg-destructive"
              : sla.percentUsed > 70
                ? "bg-prio-high"
                : "bg-status-resolved",
          )}
          style={{ width: `${Math.max(4, sla.percentUsed)}%` }}
        />
      </div>
    </div>
  );
}

export function Initials({ label, className }: { label: string; className?: string }) {
  const initials = label
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div
      className={cn(
        "panel p-5",
        tone === "accent" && "bg-primary text-primary-foreground",
        tone === "danger" && "bg-destructive/8",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium tracking-wide uppercase",
          tone === "accent" ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs",
            tone === "accent" ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
