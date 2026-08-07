# Share with Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a secure "Share with Doctor" feature allowing users to generate time-limited share links from their Health Vault and doctors to view a read-only health snapshot without logging in.

**Architecture:** A public API route `/api/health-share/$token` validates share tokens against `health_shares` and returns `getHealthContext()`. A public frontend route `/health-share/$token` displays the read-only snapshot with `noindex`. A management component `HealthVaultShareManager` in `health-vault.tsx` lets users generate, view, copy, and revoke shares.

**Tech Stack:** TanStack Start, React, Supabase, Tailwind CSS, Lucide Icons.

## Global Constraints
- Token expiration defaults to 24 hours (configurable).
- Use random unguessable tokens (`crypto.randomUUID()`).
- Doctor view must NOT be indexed by search engines (`noindex`) and must be outside `_authenticated` route tree.
- Reuse `getHealthContext()` without duplicating queries.
- Zero build errors (`npm run build`).

---

### Task 1: Create Public API Route for Health Share Validation & Context Retrieval

**Files:**
- Create: `src/routes/api/health-share/$token.ts`

**Interfaces:**
- Consumes: `health_shares` table, `getHealthContext()` from `@/lib/health-context`.
- Produces: JSON response with health context or expiration error.

- [ ] **Step 1: Write the API route file**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext } from "@/lib/health-context";

export const Route = createFileRoute("/api/health-share/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { token } = params;
        if (!token) {
          return new Response(JSON.stringify({ error: "Token required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Verify share token exists, is not revoked, and not expired
        const { data: share, error: shareError } = await supabase
          .from("health_shares")
          .select("user_id, expires_at, revoked_at")
          .eq("token", token)
          .maybeSingle();

        if (shareError || !share) {
          return new Response(JSON.stringify({ error: "Link not found", expired: true }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const now = new Date();
        const expiresAt = new Date(share.expires_at);
        if (share.revoked_at || expiresAt <= now) {
          return new Response(JSON.stringify({ error: "This link has expired or has been revoked", expired: true }), {
            status: 410,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Fetch health context for user_id
        try {
          const healthContext = await getHealthContext(supabaseUrl, supabaseServiceKey, share.user_id, true);
          return new Response(JSON.stringify({ success: true, healthContext, expiresAt: share.expires_at }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || "Failed to load health context" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 2: Commit changes**

```bash
git add src/routes/api/health-share/\$token.ts
git commit -m "feat: add health-share api route for token validation and context"
```

---

### Task 2: Create Public Doctor-Facing View Route (`/health-share/$token`)

**Files:**
- Create: `src/routes/health-share/$token.tsx`
- Delete/Replace: Any old `src/routes/_authenticated/health-share/$token.tsx` if present.

**Interfaces:**
- Consumes: `/api/health-share/$token` endpoint.
- Produces: Read-only doctor-facing health snapshot with `noindex`.

- [ ] **Step 1: Remove old authenticated share route if it exists**

```bash
rm -f src/routes/_authenticated/health-share/\$token.tsx
```

- [ ] **Step 2: Create public doctor-facing route**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Stethoscope, AlertTriangle, ShieldCheck, Clock, User, Heart, AlertCircle, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { HealthContext } from "@/integrations/supabase/health-vault";

export const Route = createFileRoute("/health-share/$token")({
  component: DoctorShareViewPage,
});

function severityTone(severity: string | null): StatusTone {
  if (severity === "life_threatening" || severity === "severe") return "danger";
  if (severity === "moderate") return "warning";
  return "success";
}

function DoctorShareViewPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ healthContext: HealthContext; expiresAt: string } | null>(null);

  useEffect(() => {
    async function fetchShare() {
      try {
        const res = await fetch(`/api/health-share/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "This link has expired or is invalid.");
        } else {
          setData(json);
        }
      } catch (err) {
        setError("Failed to load health summary. Please check the link.");
      } finally {
        setLoading(false);
      }
    }
    fetchShare();
  }, [token]);

  // Inject noindex meta tag
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Stethoscope className="mx-auto h-10 w-10 animate-pulse text-primary" />
          <p className="text-muted-foreground font-medium">Loading secure health record...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Link Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error || "This link has expired, been revoked, or is invalid."}</p>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              For security and patient privacy, shared health links have a limited lifespan and can be revoked by the patient at any time.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { healthContext, expiresAt } = data;
  const { profile, healthVault, allergies, medicalHistoryEvents, latestVitals, activeMedications, flaggedAbnormalities } = healthContext;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-card border p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <ShieldCheck className="h-4 w-4" />
              SomaCare Secure Doctor View (Read-Only)
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {profile.display_name || "Patient"} Health Summary
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-xl">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>Expires: {new Date(expiresAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Flagged Abnormalities */}
        {flaggedAbnormalities && flaggedAbnormalities.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Flagged Health Concerns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                {flaggedAbnormalities.map((ab, i) => (
                  <li key={i}>{ab}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Demographics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Patient Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Full Name</span>
                <span className="font-medium">{profile.display_name || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Age</span>
                <span className="font-medium">{healthVault.age ? `${healthVault.age} yrs` : "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Gender / Sex</span>
                <span className="font-medium">{healthVault.gender || profile.sex || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Blood Type</span>
                <span className="font-medium">{profile.blood_type || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Height / Weight</span>
                <span className="font-medium">
                  {[profile.height_cm ? `${profile.height_cm} cm` : null, healthVault.body_weight_kg ? `${healthVault.body_weight_kg} kg` : null].filter(Boolean).join(" / ") || "Not specified"}
                </span>
              </div>
              {healthVault.is_pregnant !== null && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pregnancy Status</span>
                  <span className="font-medium">{healthVault.is_pregnant ? "Pregnant" : "Not pregnant"}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lifestyle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-5 w-5" />
                Lifestyle & Habits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Smoking Status</span>
                <span className="font-medium capitalize">{healthVault.smoking_status || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Alcohol Use</span>
                <span className="font-medium capitalize">{healthVault.alcohol_use || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Dietary Preference</span>
                <span className="font-medium capitalize">
                  {healthVault.dietary_preference === "other" ? healthVault.dietary_preference_other : healthVault.dietary_preference || "Not specified"}
                </span>
              </div>
              {healthVault.health_goals && healthVault.health_goals.length > 0 && (
                <div className="py-1">
                  <span className="text-muted-foreground block mb-1">Health Goals</span>
                  <div className="flex flex-wrap gap-1">
                    {healthVault.health_goals.map((g, i) => (
                      <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {g.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!allergies || allergies.length === 0) ? (
                <p className="text-sm text-muted-foreground">No known allergies recorded.</p>
              ) : (
                <div className="space-y-2">
                  {allergies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <div>
                        <span className="font-medium">{a.allergen}</span>
                        {a.reaction && <span className="text-muted-foreground block text-xs">{a.reaction}</span>}
                      </div>
                      <StatusBadge tone={severityTone(a.severity)}>
                        {a.severity?.replace(/_/g, " ") || "unknown"}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Medications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-5 w-5 text-primary" />
                Active Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!activeMedications || activeMedications.length === 0) ? (
                <p className="text-sm text-muted-foreground">No active medications recorded.</p>
              ) : (
                <div className="space-y-2">
                  {activeMedications.map((m, i) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/50 text-sm flex justify-between items-center">
                      <div>
                        <span className="font-medium">{m.name}</span>
                        {m.dose && <span className="text-muted-foreground text-xs ml-2">({m.dose})</span>}
                      </div>
                      {m.frequency && <span className="text-xs bg-background px-2 py-1 rounded border">{m.frequency}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chronic Conditions & Past Illnesses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Medical History & Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block font-medium mb-1">Chronic Conditions</span>
                {(!healthVault.chronic_conditions || healthVault.chronic_conditions.length === 0) ? (
                  <p className="text-xs text-muted-foreground">None recorded</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {healthVault.chronic_conditions.map((c, i) => (
                      <span key={i} className="rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium">{c}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block font-medium mb-1">Past Illnesses</span>
                {(!healthVault.past_illnesses || healthVault.past_illnesses.length === 0) ? (
                  <p className="text-xs text-muted-foreground">None recorded</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {healthVault.past_illnesses.map((p, i) => (
                      <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{p}</span>
                    ))}
                  </div>
                )}
              </div>
              {medicalHistoryEvents && medicalHistoryEvents.length > 0 && (
                <div>
                  <span className="text-muted-foreground block font-medium mb-1">Surgeries & Procedures</span>
                  <div className="space-y-1">
                    {medicalHistoryEvents.map((e, i) => (
                      <div key={i} className="text-xs bg-muted/50 p-2 rounded flex justify-between">
                        <span>{e.description} ({e.event_type})</span>
                        {e.event_date && <span className="text-muted-foreground">{e.event_date}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Vitals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              {(!latestVitals || latestVitals.length === 0) ? (
                <p className="text-sm text-muted-foreground">No recent vitals recorded.</p>
              ) : (
                <div className="space-y-2">
                  {latestVitals.map((v, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 text-sm">
                      <span className="capitalize font-medium">{v.kind.replace(/_/g, " ")}</span>
                      <div className="text-right">
                        <span className="font-bold">{v.value}</span>
                        {v.unit && <span className="text-muted-foreground text-xs ml-1">{v.unit}</span>}
                        <span className="text-muted-foreground text-xs block">{new Date(v.taken_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Emergency Contact */}
        {(healthVault.emergency_contact_name || healthVault.emergency_contact_phone) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-5 w-5 text-primary" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium block">{healthVault.emergency_contact_name || "Not specified"}</span>
                <span className="text-muted-foreground text-xs">Emergency Contact</span>
              </div>
              {healthVault.emergency_contact_phone && (
                <a href={`tel:${healthVault.emergency_contact_phone}`} className="font-semibold text-primary hover:underline">
                  {healthVault.emergency_contact_phone}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          Powered by SomaCare Health Vault • Secure Medical Summary
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit changes**

```bash
git add src/routes/health-share/\$token.tsx
git commit -m "feat: add public read-only doctor-facing health share view with noindex"
```

---

### Task 3: Create User Share Manager Component (`HealthVaultShareManager.tsx`)

**Files:**
- Create: `src/components/health-vault/HealthVaultShareManager.tsx`

**Interfaces:**
- Consumes: Supabase client, user session.
- Produces: UI component for generating, listing, copying, and revoking health shares.

- [ ] **Step 1: Create the component file**

```typescript
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, Plus, Copy, Trash2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

type HealthShare = {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
};

export function HealthVaultShareManager() {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expireHours, setExpireHours] = useState("24");

  const sharesQuery = useQuery({
    queryKey: ["health-shares"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("health_shares")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as HealthShare[];
    },
  });

  const createShareMutation = useMutation({
    mutationFn: async (hours: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("health_shares").insert({
        user_id: user.id,
        token,
        expires_at: expiresAt,
      });

      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["health-shares"] });
      setShowCreateModal(false);
      toast.success("Share link created successfully!");
      const shareUrl = `${window.location.origin}/health-share/${token}`;
      navigator.clipboard.writeText(shareUrl);
      toast.info("Link copied to clipboard!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create share link");
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("health_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-shares"] });
      toast.success("Share link revoked.");
    },
    onError: () => {
      toast.error("Failed to revoke share link");
    },
  });

  const handleCopy = (token: string) => {
    const shareUrl = `${window.location.origin}/health-share/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const shares = sharesQuery.data || [];

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          Share with Doctor
        </CardTitle>
        <Button onClick={() => setShowCreateModal(true)} className="soma-gradient soma-glow border-0 text-white">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Share Link
        </Button>
      </CardHeader>
      <CardContent>
        {shares.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No share links created yet. Generate a secure, time-limited link to share your Health Vault snapshot with your doctor.
          </div>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => {
              const isExpired = new Date(share.expires_at) <= new Date();
              const isRevoked = !!share.revoked_at;
              const isActive = !isExpired && !isRevoked;

              return (
                <div key={share.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/50 border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{share.token.slice(0, 8)}...</span>
                      {isActive && <StatusToneBadge tone="success">Active</StatusToneBadge>}
                      {isExpired && <StatusToneBadge tone="warning">Expired</StatusToneBadge>}
                      {isRevoked && <StatusToneBadge tone="danger">Revoked</StatusToneBadge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created: {new Date(share.created_at).toLocaleDateString()} • Expires: {new Date(share.expires_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Button variant="outline" size="sm" onClick={() => handleCopy(share.token)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                      </Button>
                    )}
                    {isActive && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeShareMutation.mutate(share.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Doctor Share Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will generate a secure, read-only link containing your Health Vault snapshot (vitals, allergies, medications, and history).
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Link Expiration</label>
              <Select value={expireHours} onValueChange={setExpireHours}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 Hours (Recommended)</SelectItem>
                  <SelectItem value="48">48 Hours</SelectItem>
                  <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              onClick={() => createShareMutation.mutate(parseInt(expireHours))}
              disabled={createShareMutation.isPending}
              className="soma-gradient soma-glow border-0 text-white"
            >
              {createShareMutation.isPending ? "Generating..." : "Generate & Copy Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusToneBadge({ tone, children }: { tone: "success" | "warning" | "danger"; children: React.ReactNode }) {
  const colors = {
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/health-vault/HealthVaultShareManager.tsx
git commit -m "feat: add HealthVaultShareManager component for user-facing share management"
```

---

### Task 4: Integrate Share Manager into Health Vault Page & Build Verification

**Files:**
- Modify: `src/routes/_authenticated/health-vault.tsx`
- Test: Run `npm run build`

**Interfaces:**
- Consumes: `HealthVaultShareManager` from `@/components/health-vault/HealthVaultShareManager`.
- Produces: Integrated Health Vault page.

- [ ] **Step 1: Edit `src/routes/_authenticated/health-vault.tsx` to import and render `HealthVaultShareManager`**

Read `src/routes/_authenticated/health-vault.tsx` around the bottom of the grid, then add `<HealthVaultShareManager />`.

- [ ] **Step 2: Run build test**

```bash
npm run build
```
Expected: Zero build errors.

- [ ] **Step 3: Commit final changes**

```bash
git add src/routes/_authenticated/health-vault.tsx
git commit -m "feat: integrate HealthVaultShareManager into health vault page"
```
