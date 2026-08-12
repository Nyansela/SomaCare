import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Upload, Download, Trash2, Loader2, FileIcon, ImageIcon } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Record = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [{ title: "Records — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: RecordsPage,
});

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function RecordsPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("records")
      .select("*")
      .order("created_at", { ascending: false });
    setRecords((data as Record[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("records").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("records").insert({
        user_id: u.user.id,
        title: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category: file.type.startsWith("image/") ? "image" : "document",
      });
      if (insErr) throw insErr;
      toast.success("Uploaded");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (r: Record) => {
    const { data, error } = await supabase.storage.from("records").createSignedUrl(r.file_path, 60);
    if (error || !data) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (r: Record) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    await supabase.storage.from("records").remove([r.file_path]);
    await supabase.from("records").delete().eq("id", r.id);
    setRecords((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Deleted");
  };

  return (
    <AppShell
      title="Health Records"
      subtitle="Encrypted documents, reports & images"
      action={
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Upload
        </Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No records uploaded yet"
          body="Upload lab results, scans or prescriptions to keep them organized and accessible."
          action={
            <Button
              onClick={() => fileRef.current?.click()}
              className="soma-gradient soma-glow border-0 text-white"
            >
              <Upload className="mr-2 h-4 w-4" /> Upload your first record
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((r, i) => {
            const isImg = (r.mime_type ?? "").startsWith("image/");
            const Icon = isImg ? ImageIcon : FileIcon;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="soma-card group flex flex-col gap-3 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold" title={r.title}>
                      {r.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(r.size_bytes)} ·{" "}
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {r.category && (
                  <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {r.category}
                  </span>
                )}
                <div className="mt-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => download(r)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(r)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
