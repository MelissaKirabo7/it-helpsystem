import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ServeDesk IT Ticketing" },
      {
        name: "description",
        content:
          "Sign in to ServeDesk to log an IT request, follow its progress and work the technician queue.",
      },
      { property: "og:title", content: "Sign in — ServeDesk IT Ticketing" },
      {
        property: "og:description",
        content: "Secure email and password sign-in for the ServeDesk IT ticketing system.",
      },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid work email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  department: z.string().trim().max(60),
  room: z.string().trim().max(80),
  workstation: z.string().trim().max(60),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [room, setRoom] = useState("");
  const [workstation, setWorkstation] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) void navigate({ to: "/" });
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      } else {
        const parsed = signUpSchema.safeParse({
          fullName,
          email,
          password,
          department,
          room,
          workstation,
        });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
        const { data, error: err } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (data.user && data.session) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            full_name: parsed.data.fullName,
            email: parsed.data.email,
            department: parsed.data.department,
            room: parsed.data.room,
            workstation: parsed.data.workstation,
          });
        } else {
          setInfo("Check your inbox to confirm your email, then sign in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LifeBuoy className="size-5" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">ServeDesk</span>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-6">
          <div className="flex gap-2 rounded-full bg-muted p-1 text-sm font-semibold">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 transition-colors",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <Input label="Full name" value={fullName} onChange={setFullName} />
          )}
          <Input label="Work email" type="email" value={email} onChange={setEmail} />
          <Input label="Password" type="password" value={password} onChange={setPassword} />
          {mode === "signup" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Department" value={department} onChange={setDepartment} />
              <Input label="Room" value={room} onChange={setRoom} />
              <Input label="Workstation" value={workstation} onChange={setWorkstation} />
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {info && <p className="text-sm font-medium text-status-resolved">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Your name, department and workstation are attached to every ticket you log.
          </p>
        </form>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/15"
      />
    </label>
  );
}
