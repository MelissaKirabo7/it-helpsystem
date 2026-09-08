export type Role = "submitter" | "technician" | "admin";

export const STATUSES = ["New", "In Progress", "Pending", "Resolved"] as const;
export type Status = (typeof STATUSES)[number];

/** Statuses a technician can pick inside the active queue (Resolved uses its own flow). */
export const ACTIVE_STATUSES = ["New", "In Progress", "Pending"] as const;

export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  "Hardware",
  "Software",
  "Network/Wi-Fi",
  "Printing",
  "Peripherals",
  "Access/Passwords",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type NoteVisibility = "internal" | "public";

/** Days a submitter may reopen a resolved ticket. */
export const REOPEN_WINDOW_DAYS = 5;

export type Ticket = {
  id: string;
  ref: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  submitterId: string | null;
  submitter: string;
  submitterEmail: string;
  department: string;
  room: string;
  workstation: string;
  assigneeId: string | null;
  assigneeName: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  reopenedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TicketNote = {
  id: string;
  author: string;
  authorId: string | null;
  visibility: NoteVisibility;
  body: string;
  at: string;
};

export type TicketEvent = {
  id: string;
  label: string;
  at: string;
};

export type TicketAttachment = {
  id: string;
  ticketId: string;
  noteId: string | null;
  path: string;
  fileName: string;
};

/** SLA response windows in hours, per priority (requirements 4.1). */
export const SLA_HOURS: Record<Priority, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 48,
};

export function slaDeadline(ticket: Ticket): Date {
  return new Date(new Date(ticket.createdAt).getTime() + SLA_HOURS[ticket.priority] * 3600_000);
}

export type SlaState = {
  deadline: Date;
  msLeft: number;
  percentUsed: number;
  overdue: boolean;
  label: string;
};

export function slaState(ticket: Ticket, now = Date.now()): SlaState {
  const deadline = slaDeadline(ticket);
  const total = SLA_HOURS[ticket.priority] * 3600_000;
  const msLeft = deadline.getTime() - now;
  const percentUsed = Math.min(100, Math.max(0, ((total - msLeft) / total) * 100));
  const abs = Math.abs(msLeft);
  const h = Math.floor(abs / 3600_000);
  const m = Math.floor((abs % 3600_000) / 60_000);
  const span = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return {
    deadline,
    msLeft,
    percentUsed,
    overdue: msLeft < 0,
    label: msLeft < 0 ? `${span} overdue` : `${span} left`,
  };
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/** True while the author may still reopen a resolved ticket. */
export function reopenWindow(ticket: Ticket, now = Date.now()) {
  if (ticket.status !== "Resolved" || !ticket.resolvedAt) return { open: false, daysLeft: 0 };
  const closesAt = new Date(ticket.resolvedAt).getTime() + REOPEN_WINDOW_DAYS * 86_400_000;
  const msLeft = closesAt - now;
  return { open: msLeft > 0, daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)) };
}
