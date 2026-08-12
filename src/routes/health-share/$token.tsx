import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Stethoscope,
  AlertTriangle,
  ShieldCheck,
  Clock,
  User,
  Heart,
  AlertCircle,
  Phone,
} from "lucide-react";
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
  const [data, setData] = useState<{ healthContext: HealthContext; expiresAt: string } | null>(
    null,
  );

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
            <p className="text-muted-foreground">
              {error || "This link has expired, been revoked, or is invalid."}
            </p>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              For security and patient privacy, shared health links have a limited lifespan and can
              be revoked by the patient at any time.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { healthContext, expiresAt } = data;
  const {
    profile,
    healthVault,
    allergies,
    medicalHistoryEvents,
    latestVitals,
    activeMedications,
    flaggedAbnormalities,
  } = healthContext;

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
                <span className="font-medium">
                  {healthVault.age ? `${healthVault.age} yrs` : "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Gender / Sex</span>
                <span className="font-medium">
                  {healthVault.gender || profile.sex || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Blood Type</span>
                <span className="font-medium">{profile.blood_type || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Height / Weight</span>
                <span className="font-medium">
                  {[
                    profile.height_cm ? `${profile.height_cm} cm` : null,
                    healthVault.body_weight_kg ? `${healthVault.body_weight_kg} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "Not specified"}
                </span>
              </div>
              {healthVault.is_pregnant !== null && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pregnancy Status</span>
                  <span className="font-medium">
                    {healthVault.is_pregnant ? "Pregnant" : "Not pregnant"}
                  </span>
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
                <span className="font-medium capitalize">
                  {healthVault.smoking_status || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Alcohol Use</span>
                <span className="font-medium capitalize">
                  {healthVault.alcohol_use || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Dietary Preference</span>
                <span className="font-medium capitalize">
                  {healthVault.dietary_preference === "other"
                    ? healthVault.dietary_preference_other
                    : healthVault.dietary_preference || "Not specified"}
                </span>
              </div>
              {healthVault.health_goals && healthVault.health_goals.length > 0 && (
                <div className="py-1">
                  <span className="text-muted-foreground block mb-1">Health Goals</span>
                  <div className="flex flex-wrap gap-1">
                    {healthVault.health_goals.map((g, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium"
                      >
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
              {!allergies || allergies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No known allergies recorded.</p>
              ) : (
                <div className="space-y-2">
                  {allergies.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <div>
                        <span className="font-medium">{a.allergen}</span>
                        {a.reaction && (
                          <span className="text-muted-foreground block text-xs">{a.reaction}</span>
                        )}
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
              {!activeMedications || activeMedications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active medications recorded.</p>
              ) : (
                <div className="space-y-2">
                  {activeMedications.map((m, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-muted/50 text-sm flex justify-between items-center"
                    >
                      <div>
                        <span className="font-medium">{m.name}</span>
                        {m.dose && (
                          <span className="text-muted-foreground text-xs ml-2">({m.dose})</span>
                        )}
                      </div>
                      {m.frequency && (
                        <span className="text-xs bg-background px-2 py-1 rounded border">
                          {m.frequency}
                        </span>
                      )}
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
                <span className="text-muted-foreground block font-medium mb-1">
                  Chronic Conditions
                </span>
                {!healthVault.chronic_conditions || healthVault.chronic_conditions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None recorded</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {healthVault.chronic_conditions.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block font-medium mb-1">Past Illnesses</span>
                {!healthVault.past_illnesses || healthVault.past_illnesses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None recorded</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {healthVault.past_illnesses.map((p, i) => (
                      <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {medicalHistoryEvents && medicalHistoryEvents.length > 0 && (
                <div>
                  <span className="text-muted-foreground block font-medium mb-1">
                    Surgeries & Procedures
                  </span>
                  <div className="space-y-1">
                    {medicalHistoryEvents.map((e, i) => (
                      <div key={i} className="text-xs bg-muted/50 p-2 rounded flex justify-between">
                        <span>
                          {e.description} ({e.event_type})
                        </span>
                        {e.event_date && (
                          <span className="text-muted-foreground">{e.event_date}</span>
                        )}
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
              {!latestVitals || latestVitals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent vitals recorded.</p>
              ) : (
                <div className="space-y-2">
                  {latestVitals.map((v, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <span className="capitalize font-medium">{v.kind.replace(/_/g, " ")}</span>
                      <div className="text-right">
                        <span className="font-bold">{v.value}</span>
                        {v.unit && (
                          <span className="text-muted-foreground text-xs ml-1">{v.unit}</span>
                        )}
                        <span className="text-muted-foreground text-xs block">
                          {new Date(v.taken_at).toLocaleDateString()}
                        </span>
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
                <span className="font-medium block">
                  {healthVault.emergency_contact_name || "Not specified"}
                </span>
                <span className="text-muted-foreground text-xs">Emergency Contact</span>
              </div>
              {healthVault.emergency_contact_phone && (
                <a
                  href={`tel:${healthVault.emergency_contact_phone}`}
                  className="font-semibold text-primary hover:underline"
                >
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
