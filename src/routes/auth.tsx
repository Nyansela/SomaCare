import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stethoscope, Loader2, Clock, Eye, EyeOff, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { useTranslation } from "react-i18next";

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

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  const status = (err as { status?: number }).status;
  return (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("email rate limit")
  );
}

function isEmailNotConfirmedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  return (
    msg.includes("email not confirmed") ||
    msg.includes("email address has not been confirmed") ||
    msg.includes("confirm your email")
  );
}

function isDuplicateNameError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  return (
    msg.includes("duplicate key") &&
    msg.includes("display_name")
  );
}

/** Returns a password strength score 0-3 and which checks pass. */
function getPasswordStrength(pw: string) {
  const checks = {
    length: pw.length >= 8,
    letter: /[a-zA-Z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
}

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PART B state: post-signup email confirmation screen ─────────────
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);

  // ── PART B state: email not confirmed on login ──────────────────────
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);

  // ── PART A state: display_name availability ─────────────────────────
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── PART C state: password strength ────────────────────────────────
  const { checks: pwChecks, score: pwScore } = getPasswordStrength(password);

  // Only hit the network if we actually have a cached session to refresh.
  useEffect(() => {
    const hasAnySupabaseKey = Object.keys(localStorage).some((k) => k.startsWith("sb-"));
    if (!hasAnySupabaseKey) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (rateLimitSeconds <= 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setRateLimitSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [rateLimitSeconds]);

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

  const handleRateLimit = useCallback(() => {
    setRateLimitSeconds(60);
    toast.error(t("auth.rateLimitMessage"));
  }, [t]);

  // ── PART A: Debounced display_name availability check ───────────────
  const checkNameAvailability = useCallback(async (displayName: string) => {
    if (!displayName || displayName.trim().length < 2) {
      setNameAvailable(null);
      setCheckingName(false);
      return;
    }
    setCheckingName(true);
    try {
      const { data, error } = await supabase.rpc("check_display_name_available", {
        name_to_check: displayName.trim(),
      });
      if (error) {
        // If the RPC doesn't exist yet (migration not applied), skip check silently
        setNameAvailable(null);
      } else {
        setNameAvailable(data as boolean);
      }
    } catch {
      setNameAvailable(null);
    } finally {
      setCheckingName(false);
    }
  }, []);

  const onNameChange = useCallback((value: string) => {
    setName(value);
    if (nameCheckRef.current) clearTimeout(nameCheckRef.current);
    nameCheckRef.current = setTimeout(() => {
      checkNameAvailability(value);
    }, 500);
  }, [checkNameAvailability]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (nameCheckRef.current) clearTimeout(nameCheckRef.current);
    };
  }, []);

  // ── PART B: Resend confirmation email ──────────────────────────────
  const handleResendConfirmation = useCallback(async () => {
    if (!pendingEmail) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
      toast.success(t("auth.confirmationResent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.somethingWrong"));
    } finally {
      setResendingEmail(false);
    }
  }, [pendingEmail, t]);

  // ── PART B: Resend from login "email not confirmed" state ──────────
  const handleResendFromLogin = useCallback(async () => {
    if (!email) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
      toast.success(t("auth.confirmationResent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.somethingWrong"));
    } finally {
      setResendingEmail(false);
    }
  }, [email, t]);

  // ── Main email submit handler ───────────────────────────────────────
  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimitSeconds > 0) return;
    setLoading(true);
    setEmailNotConfirmed(false);
    try {
      if (tab === "signup") {
        // ── PART C: Client-side password validation ───────────────────
        if (pwScore < 3) {
          toast.error(t("auth.passwordRequirementsNotMet"));
          setLoading(false);
          return;
        }
        // ── PART A: Check display_name availability before signup ─────
        if (name.trim() && nameAvailable === false) {
          toast.error(t("auth.nameAlreadyTaken"));
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // ── PART B: Use live URL for email redirect ────────────────
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: name },
          },
        });
        if (error) {
          // ── PART A: Catch unique constraint violation ───────────────
          if (isDuplicateNameError(error)) {
            toast.error(t("auth.nameAlreadyTaken"));
            setLoading(false);
            return;
          }
          throw error;
        }
        // ── PART B: Check if email confirmation is required ───────────
        // If Supabase returns a session immediately, email confirmation is off
        // If session is null, the user needs to confirm their email
        if (data.session) {
          // Email confirmation is disabled — go straight to onboarding
          navigate({ to: "/onboarding" });
        } else {
          // Email confirmation is enabled — show the "check your email" screen
          setEmailConfirmationPending(true);
          setPendingEmail(email);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // ── PART B: Catch "email not confirmed" error ───────────────
          if (isEmailNotConfirmedError(error)) {
            setEmailNotConfirmed(true);
            setLoading(false);
            return;
          }
          throw error;
        }
        navigate({ to: "/app" });
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        handleRateLimit();
      } else {
        toast.error(err instanceof Error ? err.message : t("auth.somethingWrong"));
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (rateLimitSeconds > 0) return;
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
          if (isRateLimitError(result.error)) {
            handleRateLimit();
          } else {
            toast.error(t("auth.googleFailed"));
          }
          setLoading(false);
          return;
        }
        if (result.redirected) return;
        navigate({ to: "/app" });
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        handleRateLimit();
      } else {
        toast.error(err instanceof Error ? err.message : t("auth.googleFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  // ── PART B: "Check your email" confirmation screen ──────────────────
  if (emailConfirmationPending) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <div className="fixed inset-0 -z-10 bg-background" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', opacity: 0.03 }} />
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("auth.checkYourEmail")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.confirmationSentTo", { email: pendingEmail })}
          </p>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("auth.confirmationInstructions")}
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={resendingEmail}
                onClick={handleResendConfirmation}
              >
                {resendingEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {t("auth.resendConfirmation")}
              </Button>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            {t("auth.checkSpamFolder")}
          </p>
          <button
            type="button"
            onClick={() => {
              setEmailConfirmationPending(false);
              setPendingEmail("");
              setTab("signin");
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("auth.backToSignIn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6">
      {/* Noise texture background */}
      <div className="fixed inset-0 -z-10 bg-background" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', opacity: 0.03 }} />

      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link to="/auth" className="inline-flex items-center gap-2 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl soma-gradient">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {tab === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {tab === "signin"
              ? t("auth.signInSubtitle")
              : t("auth.signUpSubtitle")}
          </p>
        </div>

        {/* Social logins */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-11"
            onClick={onGoogle}
            disabled={loading || rateLimitSeconds > 0}
          >
            <GoogleIcon />
            <span className="sr-only">Google</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11"
            disabled={loading || rateLimitSeconds > 0}
          >
            <AppleIcon />
            <span className="sr-only">Apple</span>
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t("auth.orContinueWith")}</span>
          </div>
        </div>

        {/* Card with form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onEmail} className="space-y-4">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("auth.name")}</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      placeholder={t("auth.namePlaceholder")}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    {/* PART A: Availability indicator */}
                    {name.trim().length >= 2 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingName ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : nameAvailable === true ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : nameAvailable === false ? (
                          <X className="h-4 w-4 text-destructive" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  {name.trim().length >= 2 && nameAvailable === false && (
                    <p className="text-xs text-destructive">{t("auth.nameAlreadyTaken")}</p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  {tab === "signin" && (
                    <Link
                      to="/auth"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("auth.forgotPassword")}
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder")}
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* ── PART C: Real-time password strength checklist ──── */}
                {tab === "signup" && password.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    <StrengthCheck
                      label={t("auth.pwCheckLength")}
                      met={pwChecks.length}
                    />
                    <StrengthCheck
                      label={t("auth.pwCheckLetter")}
                      met={pwChecks.letter}
                    />
                    <StrengthCheck
                      label={t("auth.pwCheckNumber")}
                      met={pwChecks.number}
                    />
                  </div>
                )}
              </div>

              {/* ── PART B: Email not confirmed banner on login ──────── */}
              {tab === "signin" && emailNotConfirmed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {t("auth.emailNotConfirmed")}
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {t("auth.emailNotConfirmedHint")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={resendingEmail}
                    onClick={handleResendFromLogin}
                  >
                    {resendingEmail ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-3 w-3" />
                    )}
                    {t("auth.resendConfirmation")}
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full soma-gradient soma-glow border-0"
                disabled={loading || rateLimitSeconds > 0}
              >
                {rateLimitSeconds > 0 ? (
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("auth.waitSeconds", { seconds: rateLimitSeconds })}
                  </span>
                ) : loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : tab === "signin" ? (
                  t("auth.signIn")
                ) : (
                  t("auth.createAccountButton")
                )}
              </Button>

              {rateLimitSeconds > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {t("auth.rateLimitWarning", { seconds: rateLimitSeconds })}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Switch sign in / sign up */}
        <p className="text-center text-sm text-muted-foreground">
          {tab === "signin" ? t("auth.dontHaveAccount") : t("auth.alreadyHaveAccount")}{" "}
          <button
            type="button"
            onClick={() => {
              setTab(tab === "signin" ? "signup" : "signin");
              setEmailNotConfirmed(false);
            }}
            className="font-medium text-foreground hover:underline underline-offset-4"
          >
            {tab === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
          </button>
        </p>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          {t("auth.termsText")}{" "}
          <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">{t("auth.terms")}</Link>
          {" "}{t("auth.and")}{" "}
          <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">{t("auth.privacy")}</Link>.
          <br />
          {t("auth.disclaimer")}
        </p>
      </div>
    </div>
  );
}

// ── Small helper: password strength check row ────────────────────────
function StrengthCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
      {label}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
