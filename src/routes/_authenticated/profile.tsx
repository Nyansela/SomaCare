"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, Calendar, Heart, Shield, Award, Save, Loader2, Phone, MapPin, Stethoscope, Activity, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    display_name: "",
    date_of_birth: "",
    sex: "",
    blood_type: "",
    height_cm: "",
    avatar_url: "",
    locale: "en",
    emergency_name: "",
    emergency_phone: "",
    emergency_relation: "",
  });

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Fetch profile and user session
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["user-profile-details"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return profile;
    },
  });

  useEffect(() => {
    if (profileData) {
      const contacts = Array.isArray(profileData.emergency_contacts)
        ? (profileData.emergency_contacts[0] as any) || {}
        : {};

      setFormData({
        display_name: profileData.display_name || "",
        date_of_birth: profileData.date_of_birth || "",
        sex: profileData.sex || "",
        blood_type: profileData.blood_type || "",
        height_cm: profileData.height_cm ? String(profileData.height_cm) : "",
        avatar_url: profileData.avatar_url || "",
        locale: profileData.locale || "en",
        emergency_name: contacts.name || "",
        emergency_phone: contacts.phone || "",
        emergency_relation: contacts.relation || "",
      });
    }
  }, [profileData]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user ID");

      const emergencyContacts = formData.emergency_name
        ? [{ name: formData.emergency_name, phone: formData.emergency_phone, relation: formData.emergency_relation }]
        : [];

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: formData.display_name,
          date_of_birth: formData.date_of_birth || null,
          sex: formData.sex || null,
          blood_type: formData.blood_type || null,
          height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
          avatar_url: formData.avatar_url || null,
          locale: formData.locale,
          emergency_contacts: emergencyContacts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["user-profile-details"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Profile" subtitle="Manage your personal and medical profile">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="User Profile"
      subtitle="Manage your personal details, emergency contact, and baseline information"
      action={
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Header card with avatar & account info */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col md:flex-row items-center gap-6 p-6">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-3xl overflow-hidden border-2 border-primary/20">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12" />
              )}
            </div>
            <div className="flex-1 text-center md:text-left space-y-1">
              <h2 className="text-2xl font-bold font-display">{formData.display_name || "SomaCare User"}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                <Mail className="h-4 w-4" /> {email}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Shield className="h-3 w-3" /> Verified Member
                </span>
                {formData.blood_type && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                    <Heart className="h-3 w-3" /> Blood Type: {formData.blood_type}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
            <CardDescription>Update your personal details used across your health records and AI assistance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => updateField("display_name", e.target.value)}
                placeholder="e.g. Kwame Mensah"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateField("date_of_birth", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="sex">Sex</Label>
              <Select value={formData.sex} onValueChange={(v) => updateField("sex", v)}>
                <SelectTrigger id="sex" className="mt-1.5">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="blood_type">Blood Type</Label>
              <Select value={formData.blood_type} onValueChange={(v) => updateField("blood_type", v)}>
                <SelectTrigger id="blood_type" className="mt-1.5">
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="height_cm">Height (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                value={formData.height_cm}
                onChange={(e) => updateField("height_cm", e.target.value)}
                placeholder="e.g. 175"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="avatar_url">Avatar Image URL</Label>
              <Input
                id="avatar_url"
                value={formData.avatar_url}
                onChange={(e) => updateField("avatar_url", e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-destructive" /> Emergency Contact
            </CardTitle>
            <CardDescription>Person to reach in case of urgent medical assistance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emergency_name">Contact Name</Label>
              <Input
                id="emergency_name"
                value={formData.emergency_name}
                onChange={(e) => updateField("emergency_name", e.target.value)}
                placeholder="e.g. Abena Mensah"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="emergency_phone">Phone Number</Label>
              <Input
                id="emergency_phone"
                value={formData.emergency_phone}
                onChange={(e) => updateField("emergency_phone", e.target.value)}
                placeholder="e.g. +233 24 123 4567"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="emergency_relation">Relationship</Label>
              <Input
                id="emergency_relation"
                value={formData.emergency_relation}
                onChange={(e) => updateField("emergency_relation", e.target.value)}
                placeholder="e.g. Spouse / Sibling"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
