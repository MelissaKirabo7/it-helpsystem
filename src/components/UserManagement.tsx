import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, Trash2, UserPlus, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  createUser,
  deleteUser,
  listUsers,
  setUserRole,
  type ManagedUser,
} from "@/lib/admin-users";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Initials } from "@/components/ticket-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Role } from "@/lib/tickets";

const roleMeta: Record<Role, { label: string; className: string }> = {
  admin: { label: "Administrator", className: "bg-primary/10 text-primary" },
  technician: { label: "Technician", className: "bg-status-progress-soft text-status-progress" },
  submitter: { label: "Submitter", className: "bg-muted text-muted-foreground" },
};

const ROLE_OPTIONS: Role[] = ["submitter", "technician", "admin"];

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        roleMeta[role].className,
      )}
    >
      {role === "admin" ? (
        <ShieldCheck className="size-3.5" />
      ) : role === "technician" ? (
        <Wrench className="size-3.5" />
      ) : null}
      {roleMeta[role].label}
    </span>
  );
}

export function UserManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["staff"] });
  };

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => setUserRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account removed");
      setPendingDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q),
    );
  }, [users, query]);

  const counts = useMemo(
    () => ({
      admin: users.filter((u) => u.role === "admin").length,
      technician: users.filter((u) => u.role === "technician").length,
      submitter: users.filter((u) => u.role === "submitter").length,
    }),
    [users],
  );

  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">User &amp; role management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} accounts · {counts.admin} admin · {counts.technician} technician ·{" "}
            {counts.submitter} submitter
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="size-4" /> New account
        </button>
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or department…"
          className="h-10 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="pb-2 font-medium">Account</th>
              <th className="pb-2 font-medium">Department</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Loading accounts…
                </td>
              </tr>
            )}
            {usersQuery.isError && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-destructive">
                  {(usersQuery.error as Error).message}
                </td>
              </tr>
            )}
            {!usersQuery.isLoading &&
              filtered.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} className="border-t border-border/60 align-middle">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Initials label={u.fullName || u.email} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.fullName || "—"}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{u.department || "—"}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <RoleBadge role={u.role} />
                        <select
                          aria-label={`Change role for ${u.fullName || u.email}`}
                          value={u.role}
                          disabled={roleMutation.isPending}
                          onChange={(e) =>
                            roleMutation.mutate({ userId: u.id, role: e.target.value as Role })
                          }
                          className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-ring/60"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {roleMeta[r].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setPendingDelete(u)}
                        disabled={isSelf}
                        title={isSelf ? "You cannot delete your own account" : "Delete account"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            {!usersQuery.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No accounts match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.fullName || pendingDelete?.email} will lose access immediately. Their
              submitted tickets remain in the archive. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) removeMutation.mutate(pendingDelete.id);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removeMutation.isPending ? "Removing…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    department: "",
    room: "",
    workstation: "",
    role: "submitter" as Role,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          department: form.department.trim(),
          room: form.room.trim(),
          workstation: form.workstation.trim(),
          role: form.role,
        },
      }),
    onSuccess: () => {
      toast.success("Account created");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-lift">
        <div className="border-b border-border/70 px-6 py-4">
          <h3 className="font-display text-lg font-semibold">Create account</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The account is created with a confirmed email and can sign in immediately.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 px-6 py-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Full name</span>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className={field}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={field}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Temporary password</span>
            <input
              required
              type="text"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters"
              className={field}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Department</span>
              <input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className={field}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Room</span>
              <input
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                className={field}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Workstation</span>
              <input
                value={form.workstation}
                onChange={(e) => setForm((f) => ({ ...f, workstation: e.target.value }))}
                className={field}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className={field}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleMeta[r].label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <UserPlus className="size-4" />
              {mutation.isPending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
