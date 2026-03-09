import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("shop_settings")
        .select("value")
        .eq("key", "admin_notifications_enabled")
        .maybeSingle();
      if (data) setEnabled(data.value === true || data.value === "true");
      setLoading(false);
    };
    load();
  }, []);

  const toggle = async (val: boolean) => {
    setEnabled(val);
    const { data: existing } = await supabase
      .from("shop_settings")
      .select("id")
      .eq("key", "admin_notifications_enabled")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("shop_settings")
        .update({ value: val })
        .eq("key", "admin_notifications_enabled");
    } else {
      await supabase
        .from("shop_settings")
        .insert({ key: "admin_notifications_enabled", value: val });
    }
    toast({ title: val ? "Notificaciones activadas" : "Notificaciones desactivadas" });
  };

  if (loading) return null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2 text-base">
          {enabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
          Notificaciones de admin
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="admin-notif" className="text-sm text-muted-foreground">
            Recibir alertas cuando se reserve, modifique o cancele una cita
          </Label>
          <Switch id="admin-notif" checked={enabled} onCheckedChange={toggle} />
        </div>
      </CardContent>
    </Card>
  );
}
