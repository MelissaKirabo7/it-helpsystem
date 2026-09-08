import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/tickets";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string;
  room: string;
  workstation: string;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  role: Role;
  isStaff: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, department, room, workstation")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile | null) ?? null);
    let list = (roleRows ?? []).map((r) => r.role as Role);
    if (list.length === 0) {
      // First ever account becomes admin + technician, everyone else a submitter.
      const { data: claimed } = await supabase.rpc("claim_initial_admin");
      if (claimed) {
        list = ["admin", "technician"];
      } else {
        await supabase.from("user_roles").insert({ user_id: uid, role: "submitter" });
        list = ["submitter"];
      }
    }
    setRoles(list);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (!next?.user) {
        setProfile(null);
        setRoles([]);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    void load(user.id);
  }, [user, load]);

  const value = useMemo<AuthState>(() => {
    const role: Role = roles.includes("admin")
      ? "admin"
      : roles.includes("technician")
        ? "technician"
        : "submitter";
    return {
      loading,
      user,
      session,
      profile,
      roles,
      role,
      isStaff: role !== "submitter",
      isAdmin: role === "admin",
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile: async () => {
        if (user) await load(user.id);
      },
    };
  }, [loading, user, session, profile, roles, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
