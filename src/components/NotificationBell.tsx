import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Generate a notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second tone (higher, short delay)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.01, ctx.currentTime);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);

    // Cleanup
    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    // Audio not available
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("notif_sound") !== "off";
  });
  const prevUnreadRef = useRef<number | null>(null);

  const { data: notifications } = useQuery({
    queryKey: ["my_notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("notif_sound", next ? "on" : "off");
      if (next) playNotificationSound(); // Preview sound
      return next;
    });
  }, []);

  // Realtime subscription with sound
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my_notifications", user.id] });
          // Play sound for new notification
          if (soundEnabled) {
            playNotificationSound();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, soundEnabled]);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["my_notifications", user.id] });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm">Notificaciones</h3>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!notifications?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sin notificaciones</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-3 py-2.5 border-b border-border last:border-0 text-sm",
                  !n.read && "bg-primary/5"
                )}
              >
                <p className="text-foreground">{n.message || "Tu cita fue actualizada."}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
