import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Share2, Plus, Copy, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type HealthShare = {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
};

export function HealthVaultShareManager() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expireHours, setExpireHours] = useState("24");

  const sharesQuery = useQuery({
    queryKey: ["health-shares"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      toast.success(t("healthVault.shareCreated", "Share link created successfully!"));
      const shareUrl = `${window.location.origin}/health-share/${token}`;
      navigator.clipboard.writeText(shareUrl);
      toast.info(t("healthVault.linkCopied", "Link copied to clipboard!"));
    },
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : t("healthVault.shareCreateFailed", "Failed to create share link"),
      );
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
      toast.success(t("healthVault.shareRevoked", "Share link revoked."));
    },
    onError: () => {
      toast.error(t("healthVault.shareRevokeFailed", "Failed to revoke share link"));
    },
  });

  const handleCopy = (token: string) => {
    const shareUrl = `${window.location.origin}/health-share/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success(t("healthVault.shareLinkCopied", "Share link copied to clipboard!"));
  };

  const shares = sharesQuery.data || [];

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          {t("healthVault.shareWithDoctor", "Share with Doctor")}
        </CardTitle>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="soma-gradient soma-glow border-0 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("healthVault.createShareLink", "Create Share Link")}
        </Button>
      </CardHeader>
      <CardContent>
        {shares.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {t("healthVault.noShares", "No share links created yet.")}{" "}
            {t(
              "healthVault.noSharesBody",
              "Generate a secure, time-limited link to share your Health Vault snapshot with your doctor.",
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => {
              const isExpired = new Date(share.expires_at) <= new Date();
              const isRevoked = !!share.revoked_at;
              const isActive = !isExpired && !isRevoked;

              return (
                <div
                  key={share.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/50 border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {share.token.slice(0, 8)}...
                      </span>
                      {isActive && (
                        <StatusToneBadge tone="success">
                          {t("healthVault.active", "Active")}
                        </StatusToneBadge>
                      )}
                      {isExpired && (
                        <StatusToneBadge tone="warning">
                          {t("healthVault.expired", "Expired")}
                        </StatusToneBadge>
                      )}
                      {isRevoked && (
                        <StatusToneBadge tone="danger">
                          {t("healthVault.revoked", "Revoked")}
                        </StatusToneBadge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("healthVault.created", "Created")}:{" "}
                      {new Date(share.created_at).toLocaleDateString()} •{" "}
                      {t("healthVault.expires", "Expires")}:{" "}
                      {new Date(share.expires_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Button variant="outline" size="sm" onClick={() => handleCopy(share.token)}>
                        <Copy className="h-3.5 w-3.5 mr-1" />{" "}
                        {t("healthVault.copyLink", "Copy Link")}
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeShareMutation.mutate(share.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("healthVault.revoke", "Revoke")}
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
            <DialogTitle>
              {t("healthVault.generateShareLink", "Generate Doctor Share Link")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t(
                "healthVault.shareLinkDisclaimer",
                "This will generate a secure, read-only link containing your Health Vault snapshot (vitals, allergies, medications, and history).",
              )}
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t("healthVault.linkExpiration", "Link Expiration")}
              </label>
              <Select value={expireHours} onValueChange={setExpireHours}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">
                    {t("healthVault.hours24", "24 Hours (Recommended)")}
                  </SelectItem>
                  <SelectItem value="48">{t("healthVault.hours48", "48 Hours")}</SelectItem>
                  <SelectItem value="72">
                    {t("healthVault.hours72", "72 Hours (3 Days)")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t("healthVault.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createShareMutation.mutate(parseInt(expireHours))}
              disabled={createShareMutation.isPending}
              className="soma-gradient soma-glow border-0 text-white"
            >
              {createShareMutation.isPending
                ? t("healthVault.generating", "Generating...")
                : t("healthVault.generateAndCopy", "Generate & Copy Link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusToneBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const colors = {
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
