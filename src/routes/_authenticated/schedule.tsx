import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, ChevronLeft, ChevronRight, Clock, Pill, UtensilsCrossed, Dumbbell, Stethoscope, Bell, Link2 } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Schedule — SomaCare" }, { name: "robots", content: "noindex" }] }),
  component: SchedulePage,
});

type ScheduleItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  item_type: "todo" | "reminder" | "custom";
  scheduled_at: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

type Appointment = {
  id: string;
  provider_name: string;
  specialty: string | null;
  starts_at: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_url: string | null;
  mode: string;
  status: string;
};

type Medication = {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
};

type NutritionPlan = {
  id: string;
  plan_data: {
    breakfast?: { time: string; description: string };
    lunch?: { time: string; description: string };
    dinner?: { time: string; description: string };
    medication_timing?: { medication: string; timing: string }[];
  };
  generated_at: string;
};

type FitnessLog = {
  id: string;
  workout_type: string | null;
  duration_minutes: number;
  logged_date: string;
  time?: string | null;
};

type TimelineItem = {
  id: string;
  time: string;
  title: string;
  subtitle?: string;
  type: "appointment" | "medication" | "meal" | "workout" | "todo" | "reminder";
  icon: React.ReactNode;
  color: string;
  link?: string;
  completed?: boolean;
  onComplete?: () => void;
  onDelete?: () => void;
};

const ITEM_TYPE_OPTIONS = [
  { value: "todo", label: "To-Do" },
  { value: "reminder", label: "Reminder" },
  { value: "custom", label: "Custom" },
];

// Badge tone + label per timeline item type
const TYPE_BADGE: Record<TimelineItem["type"], { label: string; tone: StatusTone }> = {
  appointment: { label: "Appointment", tone: "accent" },
  medication: { label: "Medication", tone: "accent" },
  meal: { label: "Meal", tone: "success" },
  workout: { label: "Workout", tone: "warning" },
  todo: { label: "To-Do", tone: "default" },
  reminder: { label: "Reminder", tone: "warning" },
};

function SchedulePage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showWeekView, setShowWeekView] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"todo" | "reminder" | "custom">("todo");
  const [scheduledTime, setScheduledTime] = useState("09:00");

  // Fetch schedule items for selected date
  const scheduleItems = useQuery({
    queryKey: ["schedule-items", selectedDate],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as ScheduleItem[] || [];
    },
  });

  // Fetch appointments for selected date
  const appointments = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("starts_at", startOfDay.toISOString())
        .lte("starts_at", endOfDay.toISOString())
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return data as Appointment[] || [];
    },
  });

  // Fetch active medications
  const medications = useQuery({
    queryKey: ["medications"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const { data, error } = await supabase
        .from("medications")
        .select("id, name, dose, frequency")
        .eq("user_id", session.user.id)
        .eq("active", true);

      if (error) throw error;
      return data as Medication[] || [];
    },
  });

  // Fetch today's nutrition plan
  const nutritionPlan = useQuery({
    queryKey: ["nutrition-today"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      // Get the most recent nutrition plan
      const { data, error } = await supabase
        .from("nutrition_plans")
        .select("*")
        .eq("user_id", session.user.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as NutritionPlan;
    },
  });

  // Fetch fitness logs for selected date
  const fitnessLogs = useQuery({
    queryKey: ["fitness", selectedDate],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const { data, error } = await supabase
        .from("fitness_logs")
        .select("id, workout_type, duration_minutes, logged_date, time")
        .eq("user_id", session.user.id)
        .eq("logged_date", selectedDate);

      if (error) throw error;
      return data as FitnessLog[] || [];
    },
  });

  // Build timeline
  const timeline: TimelineItem[] = [];

  // Add schedule items
  scheduleItems.data?.forEach(item => {
    const time = new Date(item.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    timeline.push({
      id: item.id,
      time,
      title: item.title,
      subtitle: item.description || undefined,
      type: item.item_type === "reminder" ? "reminder" : "todo",
      icon: item.item_type === "reminder" ? <Bell className="h-4 w-4" /> : <Check className="h-4 w-4" />,
      color: item.item_type === "reminder" ? "border-l-[var(--warning)]" : "border-l-[var(--info)]",
      completed: item.completed,
      onComplete: () => toggleComplete(item),
      onDelete: () => deleteItem(item.id),
    });
  });

  // Add appointments
  appointments.data?.forEach(apt => {
    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    timeline.push({
      id: apt.id,
      time,
      title: apt.provider_name,
      subtitle: `${apt.specialty || "Appointment"} • ${apt.mode}`,
      type: "appointment",
      icon: <Stethoscope className="h-4 w-4" />,
      color: "border-l-[var(--accent)]",
      link: "/appointments",
    });
  });

  // Add meals from nutrition plan
  if (nutritionPlan.data?.plan_data) {
    const planData = nutritionPlan.data;
    const meals = [
      { key: "breakfast", data: planData.plan_data.breakfast },
      { key: "lunch", data: planData.plan_data.lunch },
      { key: "dinner", data: planData.plan_data.dinner },
    ];

    meals.forEach(meal => {
      if (meal.data?.time && meal.data?.description) {
        timeline.push({
          id: `${planData.id}-${meal.key}`,
          time: meal.data.time,
          title: meal.key.charAt(0).toUpperCase() + meal.key.slice(1),
          subtitle: meal.data.description,
          type: "meal",
          icon: <UtensilsCrossed className="h-4 w-4" />,
          color: "border-l-[var(--success)]",
          link: "/nutrition",
        });
      }
    });
  }

  // Add medication timings from nutrition plan
  if (nutritionPlan.data?.plan_data?.medication_timing) {
    const planData = nutritionPlan.data;
    planData.plan_data.medication_timing.forEach((med, idx) => {
      timeline.push({
        id: `med-${planData.id}-${idx}`,
        time: med.timing.split(" ")[0] || "08:00", // Extract just the time portion
        title: `Take: ${med.medication}`,
        subtitle: med.timing,
        type: "medication",
        icon: <Pill className="h-4 w-4" />,
        color: "border-l-[var(--destructive)]",
        link: "/medications",
      });
    });
  }

  // Add fitness logs
  fitnessLogs.data?.forEach(log => {
    timeline.push({
      id: log.id,
      time: log.time || "Anytime", // Use dynamic time or default to "Anytime"
      title: log.workout_type || "Workout",
      subtitle: `${log.duration_minutes} min`,
      type: "workout",
      icon: <Dumbbell className="h-4 w-4" />,
      color: "border-l-[var(--warning)]",
      link: "/fitness",
    });
  });

  // Sort by time
  timeline.sort((a, b) => a.time.localeCompare(b.time));

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const scheduledAt = new Date(`${selectedDate}T${scheduledTime}:00`);

      const { error } = await supabase.from("schedule_items").insert({
        user_id: session.user.id,
        title: title.trim(),
        description: description.trim() || null,
        item_type: itemType,
        scheduled_at: scheduledAt.toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item added!");
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    },
  });

  const createItem = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    createItemMutation.mutate();
  };

  const toggleCompleteMutation = useMutation({
    mutationFn: async (item: ScheduleItem) => {
      const { error } = await supabase
        .from("schedule_items")
        .update({ completed: !item.completed })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    },
  });

  const toggleComplete = (item: ScheduleItem) => toggleCompleteMutation.mutate(item);

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    },
  });

  const deleteItem = (id: string) => deleteItemMutation.mutate(id);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setItemType("todo");
    setScheduledTime("09:00");
    setEditingItem(null);
  };

  const navigateDay = (direction: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(format(current, "yyyy-MM-dd"));
  };

  // Get dates for week view
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - date.getDay() + i);
    return date;
  });

  return (
    <AppShell
      title="Schedule"
      subtitle="Your unified daily view"
      action={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="soma-gradient soma-glow border-0 text-white" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Take vitamins"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={itemType} onValueChange={(v) => setItemType(v as typeof itemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createItem} className="soma-gradient soma-glow border-0 text-white">
                Add to Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
            </span>
          </div>
          <Button
            variant={showWeekView ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWeekView(!showWeekView)}
          >
            {showWeekView ? "Day View" : "Week View"}
          </Button>
        </div>

        {/* Week View */}
        {showWeekView && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map(date => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const isSelected = dateStr === selectedDate;
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        "p-2 rounded-lg text-center transition-colors",
                        isSelected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-muted",
                        isToday && !isSelected && "border border-[var(--primary)]"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
                      <div className="text-lg font-semibold">{format(date, "d")}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          </motion.div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--accent)] border-[var(--accent)]/30 rounded" /> Appointment
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--destructive)] border-[var(--destructive)]/30 rounded" /> Medication
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--success)] border-[var(--success)]/30 rounded" /> Meal
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--warning)] border-[var(--warning)]/30 rounded" /> Workout
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--info)] border-[var(--info)]/30 rounded" /> To-Do
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--warning)] border-[var(--warning)]/30 rounded" /> Reminder
          </span>
        </div>

        {/* Timeline */}
        {scheduleItems.isLoading || appointments.isLoading || nutritionPlan.isLoading || fitnessLogs.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nothing scheduled"
            body="Add to-dos, or view your appointments, meals, and medications for today."
            action={
              <Button onClick={() => setIsDialogOpen(true)} className="soma-gradient soma-glow border-0 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
            {timeline.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
              <Card className={cn(item.color, "border-l-4")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Time */}
                    <div className="w-16 shrink-0 flex items-center gap-1 text-sm font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.time}
                    </div>

                    {/* Icon & Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span className={cn("font-medium", item.completed && "line-through text-muted-foreground")}>
                          {item.title}
                        </span>
                        <StatusBadge tone={TYPE_BADGE[item.type].tone} size="sm">
                          {TYPE_BADGE[item.type].label}
                        </StatusBadge>
                        {item.link && (
                          <Link to={item.link} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> Edit
                          </Link>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">{item.subtitle}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {item.onComplete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={item.onComplete}
                        className="shrink-0"
                      >
                        {item.completed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                    )}
                    {item.onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={item.onDelete}
                        className="shrink-0 text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  );
}