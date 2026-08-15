import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SomaCare" },
      { name: "description", content: "Sign in or create your SomaCare account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  useEffect(() => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      const handleAppUrlOpen = async (event: { url: string }) => {
        const url = event.url;
        if (url && (url.includes("access_token") || url.includes("code"))) {
          try {
            const parsed = new URL(url);
            const code = parsed.searchParams.get("code");
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            } else {
              const hashParams = new URLSearchParams(parsed.hash.substring(1));
              const accessToken = hashParams.get("access_token");
              const refreshToken = hashParams.get("refresh_token");
              if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
              }
            }
            await Browser.close();
            navigate({ to: "/app" });
          } catch (e) {
            console.error("Auth callback error:", e);
          }
        }
      };
      App.addListener("appUrlOpen", handleAppUrlOpen);
      return () => {
        App.removeAllListeners();
      };
    }
  }, [navigate]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created! Please complete your health profile.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            skipBrowserRedirect: true,
            redirectTo: "com.somalabsgh.somacare://",
          },
        });
        if (error) throw error;
        if (data?.url) {
          await Browser.open({ url: data.url });
        }
      } else {
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (result.error) {
          toast.error("Google sign-in failed");
          setLoading(false);
          return;
        }
        if (result.redirected) return;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Left panel — brand */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 soma-gradient text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
        <Link to="/auth" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Soma Health Companion</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Your health,
            <br />
            intelligently organized.
          </h2>
          <p className="mt-4 max-w-md text-white/85">
            One private workspace for vitals, medications, appointments and an AI assistant that
            knows your history.
          </p>
        </div>
        <p className="text-sm text-white/70">© {new Date().getFullYear()} SomaLabsGH</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl soma-gradient">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-lg font-bold">SomaCare</span>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin"
              ? "Sign in to continue to your health workspace."
              : "Start your SomaCare journey — free, private, yours."}
          </p>

          <Button
            variant="outline"
            size="lg"
            className="mt-8 h-12 w-full"
            onClick={onGoogle}
            disabled={loading}
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or with email
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>

          <form onSubmit={onEmail} className="mt-6 space-y-4">
            {tab === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1.5 h-11"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 h-11"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full soma-gradient soma-glow border-0"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tab === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms and privacy policy. SomaCare is not a substitute
            for professional medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.99 6.99 0 0 1 5.47 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
