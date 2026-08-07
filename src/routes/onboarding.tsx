import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, User, Heart, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENDER_OPTIONS } from "@/integrations/supabase/health-vault";
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

type OnboardingData = {
  // Basic info
  displayName: string;
  age: string;
  gender: string;
  bodyWeight: string;
  
  // Location
  country: string;
  city: string;
  
  // Medical
  allergies: string;
  chronicConditions: string;
  pastIllnesses: string;
  hereditaryDiseases: string;
  
  // Emergency contact
  emergencyName: string;
  emergencyPhone: string;
};

const initialData: OnboardingData = {
  displayName: "",
  age: "",
  gender: "",
  bodyWeight: "",
  country: "",
  city: "",
  allergies: "",
  chronicConditions: "",
  pastIllnesses: "",
  hereditaryDiseases: "",
  emergencyName: "",
  emergencyPhone: "",
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>(initialData);
  const { t } = useTranslation();

  // Redirect if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate({ to: "/auth" });
    });
  }, [navigate]);

  const updateField = (field: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const parseArrayField = (value: string): string[] => {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get existing profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      // Update profile with basic info
      await supabase.from("profiles").update({
        display_name: data.displayName || profile?.display_name,
        date_of_birth: null, // Could add date picker
        sex: data.gender || null,
      }).eq("id", user.id);

      // Create/update health vault
      await supabase.from("health_vault").upsert({
        user_id: user.id,
        age: data.age ? parseInt(data.age) : null,
        body_weight_kg: data.bodyWeight ? parseFloat(data.bodyWeight) : null,
        gender: data.gender || null,
        country: data.country || null,
        city: data.city || null,
        allergies: parseArrayField(data.allergies),
        chronic_conditions: parseArrayField(data.chronicConditions),
        past_illnesses: parseArrayField(data.pastIllnesses),
        hereditary_diseases: parseArrayField(data.hereditaryDiseases),
        emergency_contact_name: data.emergencyName || null,
        emergency_contact_phone: data.emergencyPhone || null,
      });

      toast.success(t('onboarding.toast.success', { defaultValue: 'Health profile saved!' }));
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('onboarding.toast.error', { defaultValue: 'Something went wrong' }));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return data.displayName.length > 0;
    if (step === 2) return true; // Optional fields
    if (step === 3) return true; // Optional fields
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full soma-gradient">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">
            {step === 1 && t('onboarding.step1.welcome', { defaultValue: 'Welcome! Let\'s get started' })}
            {step === 2 && t('onboarding.step2.tellUs', { defaultValue: 'Tell us about yourself' })}
            {step === 3 && t('onboarding.step3.emergencyContact', { defaultValue: 'Emergency contact' })}
            {step === 4 && t('onboarding.step4.reviewInfo', { defaultValue: 'Review your info' })}
          </CardTitle>
          <CardDescription>
            {step === 1 && t('onboarding.step1.setupProfile', { defaultValue: 'Set up your health profile' })}
            {step === 2 && t('onboarding.step2.personalize', { defaultValue: 'This helps us personalize your experience' })}
            {step === 3 && t('onboarding.step3.emergencyContactOptional', { defaultValue: 'Someone we can contact in case of emergency' })}
            {step === 4 && t('onboarding.step4.makeSureCorrect', { defaultValue: 'Make sure everything looks correct' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Progress indicator */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="displayName">{t('onboarding.step1.nameLabel', { defaultValue: 'Your name *' })}</Label>
                <Input
                  id="displayName"
                  placeholder={t('onboarding.step1.namePlaceholder', { defaultValue: 'John Doe' })}
                  value={data.displayName}
                  onChange={(e) => updateField("displayName", e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">{t('onboarding.step1.ageLabel', { defaultValue: 'Age' })}</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder={t('onboarding.step1.agePlaceholder', { defaultValue: '30' })}
                    min="1"
                    max="150"
                    value={data.age}
                    onChange={(e) => updateField("age", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">{t('onboarding.step1.genderLabel', { defaultValue: 'Gender' })}</Label>
                  <Select
                    value={data.gender}
                    onValueChange={(value) => updateField("gender", value)}
                  >
                    <SelectTrigger id="gender" className="mt-1.5">
                      <SelectValue placeholder={t('onboarding.step1.genderPlaceholder', { defaultValue: 'Select...' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(`onboarding.gender.${opt.value}`, { defaultValue: opt.label })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="bodyWeight">{t('onboarding.step1.weightLabel', { defaultValue: 'Body weight (kg)' })}</Label>
                <Input
                  id="bodyWeight"
                  type="number"
                  placeholder={t('onboarding.step1.weightPlaceholder', { defaultValue: '70' })}
                  step="0.1"
                  value={data.bodyWeight}
                  onChange={(e) => updateField("bodyWeight", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {/* Step 2: Location & Medical History */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('onboarding.step2.locationOptional', { defaultValue: 'Location (optional)' })}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">{t('onboarding.step2.countryLabel', { defaultValue: 'Country' })}</Label>
                  <Input
                    id="country"
                    placeholder={t('onboarding.step2.countryPlaceholder', { defaultValue: 'United States' })}
                    value={data.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="city">{t('onboarding.step2.cityLabel', { defaultValue: 'City' })}</Label>
                  <Input
                    id="city"
                    placeholder={t('onboarding.step2.cityPlaceholder', { defaultValue: 'New York' })}
                    value={data.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <Label htmlFor="allergies">{t('onboarding.step2.allergiesLabel', { defaultValue: 'Allergies (comma separated)' })}</Label>
                <Input
                  id="allergies"
                  placeholder={t('onboarding.step2.allergiesPlaceholder', { defaultValue: 'Peanuts, Penicillin, Pollen' })}
                  value={data.allergies}
                  onChange={(e) => updateField("allergies", e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('onboarding.step2.allergiesDescription', { defaultValue: 'List any allergies to medications, foods, or environmental factors' })}
                </p>
              </div>

              <div>
                <Label htmlFor="chronicConditions">{t('onboarding.step2.chronicConditionsLabel', { defaultValue: 'Chronic conditions (comma separated)' })}</Label>
                <Input
                  id="chronicConditions"
                  placeholder={t('onboarding.step2.chronicConditionsPlaceholder', { defaultValue: 'Diabetes, Hypertension, Asthma' })}
                  value={data.chronicConditions}
                  onChange={(e) => updateField("chronicConditions", e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="pastIllnesses">{t('onboarding.step2.pastIllnessesLabel', { defaultValue: 'Past illnesses (comma separated)' })}</Label>
                <Input
                  id="pastIllnesses"
                  placeholder={t('onboarding.step2.pastIllnessesPlaceholder', { defaultValue: 'COVID-19, Appendectomy, Chickenpox' })}
                  value={data.pastIllnesses}
                  onChange={(e) => updateField("pastIllnesses", e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="hereditaryDiseases">{t('onboarding.step2.hereditaryDiseasesLabel', { defaultValue: 'Hereditary diseases in family (comma separated)' })}</Label>
                <Input
                  id="hereditaryDiseases"
                  placeholder={t('onboarding.step2.hereditaryDiseasesPlaceholder', { defaultValue: 'Heart disease, Cancer, Diabetes' })}
                  value={data.hereditaryDiseases}
                  onChange={(e) => updateField("hereditaryDiseases", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {/* Step 3: Emergency Contact */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('onboarding.step3.emergencyContactOptionalLabel', { defaultValue: 'Emergency contact (optional)' })}</span>
              </div>

              <div>
                <Label htmlFor="emergencyName">{t('onboarding.step3.contactNameLabel', { defaultValue: 'Contact name' })}</Label>
                <Input
                  id="emergencyName"
                  placeholder={t('onboarding.step3.contactNamePlaceholder', { defaultValue: 'Jane Doe' })}
                  value={data.emergencyName}
                  onChange={(e) => updateField("emergencyName", e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="emergencyPhone">{t('onboarding.step3.contactPhoneLabel', { defaultValue: 'Phone number' })}</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  placeholder={t('onboarding.step3.contactPhonePlaceholder', { defaultValue: '+1 (555) 123-4567' })}
                  value={data.emergencyPhone}
                  onChange={(e) => updateField("emergencyPhone", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.name', { defaultValue: 'Name:' })}</span>
                  <span className="font-medium">{data.displayName || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.age', { defaultValue: 'Age:' })}</span>
                  <span className="font-medium">{data.age || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.gender', { defaultValue: 'Gender:' })}</span>
                  <span className="font-medium">{data.gender || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.weight', { defaultValue: 'Weight:' })}</span>
                  <span className="font-medium">{data.bodyWeight ? `${data.bodyWeight} kg` : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.location', { defaultValue: 'Location:' })}</span>
                  <span className="font-medium">
                    {[data.city, data.country].filter(Boolean).join(", ") || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.allergies', { defaultValue: 'Allergies:' })}</span>
                  <span className="font-medium">{data.allergies || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.chronicConditions', { defaultValue: 'Chronic conditions:' })}</span>
                  <span className="font-medium">{data.chronicConditions || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step4.emergencyContact', { defaultValue: 'Emergency contact:' })}</span>
                  <span className="font-medium">
                    {data.emergencyName || "-"} {data.emergencyPhone && `(${data.emergencyPhone})`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
                {t('onboarding.buttons.back', { defaultValue: 'Back' })}
              </Button>
            )}
            {step < 4 ? (
              <Button
                className="flex-1 soma-gradient soma-glow border-0 text-white"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                {t('onboarding.buttons.continue', { defaultValue: 'Continue' })} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 soma-gradient soma-glow border-0 text-white"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('onboarding.buttons.completeSetup', { defaultValue: 'Complete Setup' })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}