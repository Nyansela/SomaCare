import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Siren, Phone, Plus, Trash2, User as UserIcon, HeartPulse } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Contact = { name: string; phone: string; relationship?: string };
type Profile = {
  blood_type: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  emergency_contacts: Contact[] | null;
};

export const Route = createFileRoute("/_authenticated/emergency")({
  head: () => ({
    meta: [{ title: "Emergency — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: EmergencyPage,
});

function EmergencyPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContact, setNewContact] = useState<Contact>({ name: "", phone: "", relationship: "" });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("blood_type,allergies,chronic_conditions,emergency_contacts")
        .eq("id", u.user.id)
        .maybeSingle();
      setProfile(
        (data as unknown as Profile) ?? {
          blood_type: null,
          allergies: [],
          chronic_conditions: [],
          emergency_contacts: [],
        },
      );
      setLoading(false);
    })();
  }, []);

  const save = async (contacts: Contact[]) => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ emergency_contacts: contacts as never })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) return toast.error("Could not save");
    setProfile((p) => (p ? { ...p, emergency_contacts: contacts } : p));
    toast.success("Saved");
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) return toast.error("Name and phone required");
    const contacts = [...(profile?.emergency_contacts ?? []), newContact];
    save(contacts);
    setNewContact({ name: "", phone: "", relationship: "" });
  };

  const removeContact = (idx: number) => {
    const contacts = (profile?.emergency_contacts ?? []).filter((_, i) => i !== idx);
    save(contacts);
  };

  return (
    <AppShell title="Emergency" subtitle="Fast access to help & medical ID">
      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        {/* SOS Card */}
        <Card className="overflow-hidden">
          <CardContent className="bg-destructive/10 p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
              <Siren className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">In an emergency</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If this is life-threatening, call your local emergency services immediately.
            </p>
            <Button
              size="lg"
              className="mt-6 h-14 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              asChild
            >
              <a href="tel:112">
                <Phone className="mr-2 h-5 w-5" /> Call emergency services
              </a>
            </Button>
          </CardContent>

          {/* Medical ID */}
          <CardContent className="border-t border-border p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <HeartPulse className="h-4 w-4 text-primary" /> Medical ID
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <IdRow label="Blood type" value={profile?.blood_type || "—"} />
                <IdRow
                  label="Allergies"
                  value={profile?.allergies?.join(", ") || "None recorded"}
                />
                <IdRow
                  label="Conditions"
                  value={profile?.chronic_conditions?.join(", ") || "None recorded"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Emergency contacts</CardTitle>
            <CardDescription className="text-xs">People to notify if you need help</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(profile?.emergency_contacts ?? []).length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No emergency contacts yet
                </p>
              )}
              {(profile?.emergency_contacts ?? []).map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone}
                      {c.relationship ? ` · ${c.relationship}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" asChild>
                    <a href={`tel:${c.phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeContact(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-dashed border-border p-3">
              <Input
                placeholder="Full name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
                <Input
                  placeholder="Relationship"
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                />
              </div>
              <Button
                onClick={addContact}
                disabled={saving}
                className="w-full soma-gradient soma-glow border-0 text-white"
              >
                <Plus className="mr-2 h-4 w-4" /> Add contact
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
