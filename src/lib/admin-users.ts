import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Role } from "@/lib/tickets";

export type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  department: string;
  room: string;
  workstation: string;
  role: Role;
  createdAt: string;
};

const ROLES = ["submitter", "technician", "admin"] as const;

/**
 * Confirms the caller holds the admin role before any privileged mutation runs.
 * Uses the SECURITY DEFINER `has_role` RPC through the caller's own authed client,
 * so a forged request without a valid admin session can never reach the service role.
 */
async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _role: "admin", _user_id: userId });
  if (error || data !== true) {
    throw new Error("Forbidden: administrator role required.");
  }
}

/** Highest-privilege role wins when a user holds more than one row. */
function topRole(roles: string[]): Role {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("technician")) return "technician";
  return "submitter";
}

/** Lists every account with its current role — admins only. */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: profErr }, { data: roleRows, error: roleErr }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, department, room, workstation, created_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (profErr) throw new Error(profErr.message);
    if (roleErr) throw new Error(roleErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      email: p.email ?? "",
      department: p.department ?? "",
      room: p.room ?? "",
      workstation: p.workstation ?? "",
      role: topRole(rolesByUser.get(p.id) ?? []),
      createdAt: p.created_at,
    }));
  });

/** Creates an account with a confirmed email and assigns its starting role. */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      fullName: z.string().trim().min(1).max(120),
      department: z.string().trim().max(120).optional().default(""),
      room: z.string().trim().max(120).optional().default(""),
      workstation: z.string().trim().max(120).optional().default(""),
      role: z.enum(ROLES).default("submitter"),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        department: data.department,
        room: data.room,
        workstation: data.workstation,
      },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Could not create the account.");
    }
    const newId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: newId,
      full_name: data.fullName,
      email: data.email,
      department: data.department,
      room: data.room,
      workstation: data.workstation,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(newId);
      throw new Error(profErr.message);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newId };
  });

/** Replaces a user's role set with a single role. Admins cannot demote themselves. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own administrator access.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

/** Permanently deletes an account and its role rows. Admins cannot delete themselves. */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
