import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadAttachments } from "@/lib/attachments";
import type {
  Category,
  NoteVisibility,
  Priority,
  Status,
  Ticket,
  TicketAttachment,
  TicketEvent,
  TicketNote,
} from "@/lib/tickets";

type Row = Record<string, unknown>;

function mapTicket(r: Row): Ticket {
  return {
    id: r["id"] as string,
    ref: (r["ref"] as string) ?? "",
    title: r["title"] as string,
    description: r["description"] as string,
    category: r["category"] as Category,
    priority: r["priority"] as Priority,
    status: r["status"] as Status,
    submitterId: (r["submitter_id"] as string | null) ?? null,
    submitter: r["submitter_name"] as string,
    submitterEmail: r["submitter_email"] as string,
    department: (r["department"] as string) ?? "",
    room: (r["room"] as string) ?? "",
    workstation: (r["workstation"] as string) ?? "",
    assigneeId: (r["assignee_id"] as string | null) ?? null,
    assigneeName: (r["assignee_name"] as string | null) ?? null,
    resolutionNotes: (r["resolution_notes"] as string | null) ?? null,
    resolvedAt: (r["resolved_at"] as string | null) ?? null,
    reopenedCount: (r["reopened_count"] as number) ?? 0,
    createdAt: r["created_at"] as string,
    updatedAt: r["updated_at"] as string,
  };
}

/** All tickets the signed-in user may see — RLS scopes this to own tickets for submitters. */
export function useTickets() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapTicket(r as Row));
    },
  });
  const tickets = q.data ?? [];
  return {
    ...q,
    tickets,
    active: tickets.filter((t) => t.status !== "Resolved"),
    archive: tickets.filter((t) => t.status === "Resolved"),
  };
}

export function useTicket(ticketId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ticket", ticketId, user?.id],
    enabled: !!user && !!ticketId,
    queryFn: async () => {
      const [ticketRes, notesRes, eventsRes, filesRes] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
        supabase
          .from("ticket_notes")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase
          .from("ticket_events")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase.from("ticket_attachments").select("*").eq("ticket_id", ticketId),
      ]);
      if (ticketRes.error) throw ticketRes.error;
      if (!ticketRes.data) return null;
      const notes: TicketNote[] = (notesRes.data ?? []).map((n) => ({
        id: n.id,
        author: n.author_name,
        authorId: n.author_id,
        visibility: n.visibility as NoteVisibility,
        body: n.body,
        at: n.created_at,
      }));
      const events: TicketEvent[] = (eventsRes.data ?? []).map((e) => ({
        id: e.id,
        label: e.label,
        at: e.created_at,
      }));
      const attachments: TicketAttachment[] = (filesRes.data ?? []).map((a) => ({
        id: a.id,
        ticketId: a.ticket_id,
        noteId: a.note_id,
        path: a.path,
        fileName: a.file_name,
      }));
      return { ticket: mapTicket(ticketRes.data as Row), notes, events, attachments };
    },
  });
}

/** Technicians + admins, for the assignment dropdown. */
export function useStaff() {
  const { isStaff } = useAuth();
  return useQuery({
    queryKey: ["staff"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(id, full_name, email)")
        .in("role", ["technician", "admin"]);
      if (error) throw error;
      const seen = new Map<string, { id: string; name: string }>();
      for (const row of data ?? []) {
        const p = (row as unknown as { profiles: { id: string; full_name: string; email: string } })
          .profiles;
        if (p) seen.set(p.id, { id: p.id, name: p.full_name || p.email });
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const items = query.data ?? [];
  return { items, unread: items.filter((n) => !n.read_at).length, markAllRead, ...query };
}

export type NewTicketInput = {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  room: string;
  files?: File[];
};

export function useTicketActions() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tickets"] });
    void qc.invalidateQueries({ queryKey: ["ticket"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const createTicket = useMutation({
    mutationFn: async (input: NewTicketInput) => {
      if (!user) throw new Error("Sign in required");
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: input.title.trim(),
          description: input.description.trim(),
          category: input.category,
          priority: input.priority,
          submitter_id: user.id,
          submitter_name: profile?.full_name || user.email || "Unknown",
          submitter_email: profile?.email || user.email || "",
          department: profile?.department ?? "",
          room: input.room.trim() || profile?.room || "",
          workstation: profile?.workstation ?? "",
        })
        .select("*")
        .single();
      if (error) throw error;
      const ticket = mapTicket(data as Row);
      if (input.files?.length) {
        await uploadAttachments(input.files, { ticketId: ticket.id, userId: user.id });
      }
      void fetch("/api/public/ticket-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "created", ticketId: ticket.id }),
      }).catch(() => undefined);
      return ticket;
    },
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: async (v: { ticketId: string; assigneeId: string | null; assigneeName: string | null; status?: Status }) => {
      const { error } = await supabase
        .from("tickets")
        .update({
          assignee_id: v.assigneeId,
          assignee_name: v.assigneeName,
          ...(v.status ? { status: v.status } : {}),
        })
        .eq("id", v.ticketId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async (v: { ticketId: string; status: Status }) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status: v.status })
        .eq("id", v.ticketId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addNote = useMutation({
    mutationFn: async (v: {
      ticketId: string;
      body: string;
      visibility: NoteVisibility;
      files?: File[];
    }) => {
      if (!user) throw new Error("Sign in required");
      const { data, error } = await supabase
        .from("ticket_notes")
        .insert({
          ticket_id: v.ticketId,
          author_id: user.id,
          author_name: profile?.full_name || user.email || "Unknown",
          visibility: v.visibility,
          body: v.body.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (v.files?.length) {
        await uploadAttachments(v.files, {
          ticketId: v.ticketId,
          noteId: data.id,
          userId: user.id,
        });
      }
    },
    onSuccess: invalidate,
  });

  const resolve = useMutation({
    mutationFn: async (v: { ticketId: string; notes: string }) => {
      const { error } = await supabase
        .from("tickets")
        .update({
          status: "Resolved",
          resolution_notes: v.notes.trim(),
          resolved_at: new Date().toISOString(),
        })
        .eq("id", v.ticketId);
      if (error) throw error;
      void fetch("/api/public/ticket-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "resolved", ticketId: v.ticketId }),
      }).catch(() => undefined);
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async (v: { ticketId: string; reason: string }) => {
      const { error } = await supabase.rpc("reopen_ticket", {
        _ticket_id: v.ticketId,
        _reason: v.reason,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createTicket, assign, setStatus, addNote, resolve, reopen };
}
