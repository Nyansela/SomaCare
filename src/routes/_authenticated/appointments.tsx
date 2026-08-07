import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, Video, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "Appointments — SomaCare" }, { name: "robots", content: "noindex" }] }),
  component: Appointments,
});

function Appointments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    provider_name: "",
    specialty: "",
    starts_at: "",
    mode: "in_person",
    location: "",
  });

  const list = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("appointments").insert({
        user_id: u.user.id,
        provider_name: form.provider_name,
        specialty: form.specialty || null,
        starts_at: new Date(form.starts_at).toISOString(),
        mode: form.mode,
        location: form.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setOpen(false);
      setForm({ provider_name: "", specialty: "", starts_at: "", mode: "in_person", location: "" });
      toast.success("Appointment added");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Appointments"
      subtitle="Book, confirm and join visits"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="soma-gradient soma-glow border-0">
              <CalendarPlus className="mr-2 h-4 w-4" /> Book
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
              className="space-y-4"
            >
              <div>
                <Label>Provider name</Label>
                <Input required value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} />
              </div>
              <div>
                <Label>Specialty</Label>
                <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Cardiology" />
              </div>
              <div>
                <Label>Date & time</Label>
                <Input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In person</SelectItem>
                    <SelectItem value="tele">Telehealth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location / link</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="soma-gradient border-0">
                  {create.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="soma-card p-6">
        {list.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : list.data && list.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {list.data.map((a) => (
              <li key={a.id} className="flex items-center gap-4 py-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full soma-gradient text-white font-semibold">
                  {a.provider_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.provider_name}</div>
                  <div className="text-xs text-muted-foreground">{a.specialty || "Consultation"}</div>
                </div>
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  {a.mode === "tele" ? <Video className="h-4 w-4 text-primary" /> : <MapPin className="h-4 w-4 text-primary" />}
                  {a.mode === "tele" ? "Telehealth" : a.location || "In person"}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{format(new Date(a.starts_at), "MMM d")}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(a.starts_at), "p")}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarPlus}
            title="No appointments yet"
            body="Book your first visit to see it here."
          />
        )}
      </div>
    </AppShell>
  );
}
