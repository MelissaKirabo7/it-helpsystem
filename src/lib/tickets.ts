export type Role = "submitter" | "technician" | "admin";

export const STATUSES = ["New", "In Progress", "Pending", "Resolved"] as const;
export type Status = (typeof STATUSES)[number];

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

export type Technician = {
  id: string;
  name: string;
  initials: string;
  team: string;
};

export const TECHNICIANS: Technician[] = [
  { id: "t1", name: "Joy Ezechukwu", initials: "JE", team: "Endpoint Support" },
  { id: "t2", name: "Daniel Okafor", initials: "DO", team: "Network Ops" },
  { id: "t3", name: "Emily Carter", initials: "EC", team: "Endpoint Support" },
  { id: "t4", name: "Marko Dorasław", initials: "MD", team: "Identity & Access" },
];

export type NoteVisibility = "internal" | "public";

export type TicketNote = {
  id: string;
  author: string;
  visibility: NoteVisibility;
  body: string;
  at: string; // ISO
};

export type TicketEvent = {
  id: string;
  label: string;
  at: string;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  submitter: string;
  submitterEmail: string;
  department: string;
  room: string;
  workstation: string;
  createdAt: string;
  updatedAt: string;
  assigneeId: string | null;
  notes: TicketNote[];
  events: TicketEvent[];
  resolutionNotes?: string;
  resolvedAt?: string;
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

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

let seq = 4180;
export function nextTicketId(): string {
  seq += 1;
  return `RC-${seq}`;
}

export const CURRENT_USER = {
  name: "Aisha Bello",
  email: "aisha.bello@lokomax.com",
  department: "Finance",
  room: "Block B · Room 214",
  workstation: "WS-FIN-214-07",
};

export const CURRENT_TECH = TECHNICIANS[0];

export const SEED_TICKETS: Ticket[] = [
  {
    id: "RC-4172",
    title: "Laptop will not power on after weekend",
    description:
      "The ThinkPad at my desk shows no lights when plugged in. I tried a different wall socket and the dock, no change.",
    category: "Hardware",
    priority: "Critical",
    status: "New",
    submitter: "Aisha Bello",
    submitterEmail: "aisha.bello@lokomax.com",
    department: "Finance",
    room: "Block B · Room 214",
    workstation: "WS-FIN-214-07",
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
    assigneeId: null,
    notes: [],
    events: [{ id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(5) }],
  },
  {
    id: "RC-4173",
    title: "Cannot reach shared drive from meeting room 3",
    description: "Wi-Fi connects but the \\\\lokomax\\shared path times out. Wired port works fine.",
    category: "Network/Wi-Fi",
    priority: "High",
    status: "In Progress",
    submitter: "Stephen John",
    submitterEmail: "stephen.john@lokomax.com",
    department: "Sales",
    room: "Block A · Meeting Room 3",
    workstation: "WS-SAL-MR3-02",
    createdAt: hoursAgo(9),
    updatedAt: hoursAgo(2),
    assigneeId: "t2",
    notes: [
      {
        id: "n1",
        author: "Daniel Okafor",
        visibility: "internal",
        body: "Access switch port 14 flapping. Swapping patch lead and monitoring for 30 min.",
        at: hoursAgo(2),
      },
      {
        id: "n2",
        author: "Daniel Okafor",
        visibility: "public",
        body: "We found a faulty network cable in that room — replacing it now, will confirm shortly.",
        at: hoursAgo(2),
      },
    ],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(9) },
      { id: "e2", label: "Assigned to Daniel Okafor", at: hoursAgo(3) },
      { id: "e3", label: "Status changed to In Progress", at: hoursAgo(3) },
    ],
  },
  {
    id: "RC-4174",
    title: "Outlook keeps asking for password every hour",
    description: "Prompted for credentials repeatedly since the password reset on Friday.",
    category: "Access/Passwords",
    priority: "Medium",
    status: "In Progress",
    submitter: "Emily Cross",
    submitterEmail: "emily.cross@lokomax.com",
    department: "HR",
    room: "Block C · Room 110",
    workstation: "WS-HR-110-01",
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(6),
    assigneeId: "t1",
    notes: [
      {
        id: "n1",
        author: "Joy Ezechukwu",
        visibility: "internal",
        body: "Cached credential conflict. Cleared Credential Manager entries, pending user restart.",
        at: hoursAgo(6),
      },
    ],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(20) },
      { id: "e2", label: "Assigned to Joy Ezechukwu", at: hoursAgo(18) },
      { id: "e3", label: "Status changed to In Progress", at: hoursAgo(18) },
    ],
  },
  {
    id: "RC-4175",
    title: "Finance floor printer jams on every duplex job",
    description: "Paper jams at tray 2 whenever double-sided printing is selected.",
    category: "Printing",
    priority: "Medium",
    status: "Pending",
    submitter: "James Liu",
    submitterEmail: "james.liu@lokomax.com",
    department: "Finance",
    room: "Block B · Print Bay",
    workstation: "WS-FIN-PRN-01",
    createdAt: hoursAgo(34),
    updatedAt: hoursAgo(8),
    assigneeId: "t3",
    notes: [
      {
        id: "n1",
        author: "Emily Carter",
        visibility: "internal",
        body: "Fuser roller worn. Replacement part ordered, ETA Thursday. Ticket parked on Pending (Parts).",
        at: hoursAgo(8),
      },
    ],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(34) },
      { id: "e2", label: "Assigned to Emily Carter", at: hoursAgo(30) },
      { id: "e3", label: "Status changed to Pending (Parts)", at: hoursAgo(8) },
    ],
  },
  {
    id: "RC-4176",
    title: "Second monitor not detected on new dock",
    description: "HDMI monitor stays black after the dock swap. Displays show only one screen.",
    category: "Peripherals",
    priority: "Low",
    status: "New",
    submitter: "Nkem Adeyemi",
    submitterEmail: "nkem.adeyemi@lokomax.com",
    department: "Marketing",
    room: "Block A · Room 305",
    workstation: "WS-MKT-305-04",
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(3),
    assigneeId: null,
    notes: [],
    events: [{ id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(3) }],
  },
  {
    id: "RC-4177",
    title: "ERP client crashes when exporting to Excel",
    description: "The export dialog closes the whole application. Reproducible on every report.",
    category: "Software",
    priority: "High",
    status: "New",
    submitter: "Aisha Bello",
    submitterEmail: "aisha.bello@lokomax.com",
    department: "Finance",
    room: "Block B · Room 214",
    workstation: "WS-FIN-214-07",
    createdAt: hoursAgo(11),
    updatedAt: hoursAgo(11),
    assigneeId: null,
    notes: [],
    events: [{ id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(11) }],
  },
  {
    id: "RC-4168",
    title: "VPN disconnects every few minutes from home",
    description: "Tunnel drops roughly every five minutes on the corporate VPN profile.",
    category: "Network/Wi-Fi",
    priority: "High",
    status: "Resolved",
    submitter: "Marta Silva",
    submitterEmail: "marta.silva@lokomax.com",
    department: "Legal",
    room: "Remote",
    workstation: "WS-LEG-RMT-09",
    createdAt: hoursAgo(52),
    updatedAt: hoursAgo(44),
    assigneeId: "t2",
    resolvedAt: hoursAgo(44),
    resolutionNotes:
      "Replaced the expired device certificate and pinned the client to gateway cluster B. Tunnel stable for 6h under test.",
    notes: [
      {
        id: "n1",
        author: "Daniel Okafor",
        visibility: "internal",
        body: "Certificate expiry confirmed in the gateway logs.",
        at: hoursAgo(47),
      },
    ],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(52) },
      { id: "e2", label: "Assigned to Daniel Okafor", at: hoursAgo(50) },
      { id: "e3", label: "Resolved — archived and submitter notified", at: hoursAgo(44) },
    ],
  },
  {
    id: "RC-4169",
    title: "Keyboard keys sticking on reception workstation",
    description: "Several keys need a hard press. Reception cannot type quickly during check-in.",
    category: "Peripherals",
    priority: "Low",
    status: "Resolved",
    submitter: "Grace Mensah",
    submitterEmail: "grace.mensah@lokomax.com",
    department: "Facilities",
    room: "Ground · Reception",
    workstation: "WS-FAC-REC-01",
    createdAt: hoursAgo(70),
    updatedAt: hoursAgo(64),
    assigneeId: "t3",
    resolvedAt: hoursAgo(64),
    resolutionNotes: "Swapped in a new USB keyboard from stock and logged the asset change.",
    notes: [],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(70) },
      { id: "e2", label: "Resolved — archived and submitter notified", at: hoursAgo(64) },
    ],
  },
  {
    id: "RC-4170",
    title: "Shared mailbox access for new payroll analyst",
    description: "Please grant payroll@lokomax.com access to the new analyst starting Monday.",
    category: "Access/Passwords",
    priority: "Medium",
    status: "Resolved",
    submitter: "Stephen John",
    submitterEmail: "stephen.john@lokomax.com",
    department: "Sales",
    room: "Block A · Room 118",
    workstation: "WS-SAL-118-03",
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(90),
    assigneeId: "t4",
    resolvedAt: hoursAgo(90),
    resolutionNotes: "Added the account to the Payroll-Mailbox security group and verified send-as rights.",
    notes: [],
    events: [
      { id: "e1", label: "Ticket submitted via self-service portal", at: hoursAgo(96) },
      { id: "e2", label: "Resolved — archived and submitter notified", at: hoursAgo(90) },
    ],
  },
];

export function techName(id: string | null): string | null {
  return TECHNICIANS.find((t) => t.id === id)?.name ?? null;
}
