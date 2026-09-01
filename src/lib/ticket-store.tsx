import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  CURRENT_TECH,
  CURRENT_USER,
  SEED_TICKETS,
  nextTicketId,
  type NoteVisibility,
  type Role,
  type Status,
  type Ticket,
} from "./tickets";

export type NewTicketInput = {
  title: string;
  description: string;
  category: Ticket["category"];
  priority: Ticket["priority"];
  room: string;
};

type Store = {
  tickets: Ticket[];
  role: Role;
  setRole: (r: Role) => void;
  /** Active queue: resolved tickets disappear from the working dashboard. */
  active: Ticket[];
  archive: Ticket[];
  createTicket: (input: NewTicketInput) => Ticket;
  assign: (ticketId: string, assigneeId: string | null) => void;
  setStatus: (ticketId: string, status: Status) => void;
  addNote: (ticketId: string, body: string, visibility: NoteVisibility) => void;
  resolve: (ticketId: string, resolutionNotes: string) => void;
};

const TicketContext = createContext<Store | null>(null);

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 9);

export function TicketProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>(SEED_TICKETS);
  const [role, setRole] = useState<Role>("technician");

  const patch = useCallback(
    (ticketId: string, fn: (t: Ticket) => Ticket) =>
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? fn(t) : t))),
    [],
  );

  const createTicket = useCallback((input: NewTicketInput) => {
    const ticket: Ticket = {
      id: nextTicketId(),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      status: "New",
      submitter: CURRENT_USER.name,
      submitterEmail: CURRENT_USER.email,
      department: CURRENT_USER.department,
      room: input.room.trim() || CURRENT_USER.room,
      workstation: CURRENT_USER.workstation,
      createdAt: now(),
      updatedAt: now(),
      assigneeId: null,
      notes: [],
      events: [{ id: rid(), label: "Ticket submitted via self-service portal", at: now() }],
    };
    setTickets((prev) => [ticket, ...prev]);
    return ticket;
  }, []);

  const assign = useCallback(
    (ticketId: string, assigneeId: string | null) =>
      patch(ticketId, (t) => ({
        ...t,
        assigneeId,
        status: t.status === "New" && assigneeId ? "In Progress" : t.status,
        updatedAt: now(),
        events: [
          ...t.events,
          {
            id: rid(),
            label: assigneeId
              ? `Assigned to ${assigneeId === CURRENT_TECH.id ? CURRENT_TECH.name : "team member"}`
              : "Unassigned",
            at: now(),
          },
        ],
      })),
    [patch],
  );

  const setStatus = useCallback(
    (ticketId: string, status: Status) =>
      patch(ticketId, (t) => ({
        ...t,
        status,
        updatedAt: now(),
        events: [...t.events, { id: rid(), label: `Status changed to ${status}`, at: now() }],
      })),
    [patch],
  );

  const addNote = useCallback(
    (ticketId: string, body: string, visibility: NoteVisibility) =>
      patch(ticketId, (t) => ({
        ...t,
        updatedAt: now(),
        notes: [
          ...t.notes,
          { id: rid(), author: CURRENT_TECH.name, visibility, body: body.trim(), at: now() },
        ],
      })),
    [patch],
  );

  const resolve = useCallback(
    (ticketId: string, resolutionNotes: string) =>
      patch(ticketId, (t) => ({
        ...t,
        status: "Resolved",
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: now(),
        updatedAt: now(),
        events: [
          ...t.events,
          { id: rid(), label: "Resolved — archived and submitter notified", at: now() },
        ],
      })),
    [patch],
  );

  const value = useMemo<Store>(
    () => ({
      tickets,
      role,
      setRole,
      active: tickets.filter((t) => t.status !== "Resolved"),
      archive: tickets.filter((t) => t.status === "Resolved"),
      createTicket,
      assign,
      setStatus,
      addNote,
      resolve,
    }),
    [tickets, role, createTicket, assign, setStatus, addNote, resolve],
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets(): Store {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTickets must be used inside <TicketProvider>");
  return ctx;
}
