import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function pushFetch(action: string, method: string, body?: any) {
  const session = (await supabase.auth.getSession()).data.session;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(
    `https://${PROJECT_ID}.supabase.co/functions/v1/push-notifications?action=${action}`,
    opts
  );
  return res.json();
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function AdminPushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setLoading(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const subscribe = async () => {
    if (!user) return;
    setToggling(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidJson = await pushFetch("vapid-key", "GET");
      if (!vapidJson.publicKey) throw new Error("No se pudo obtener la clave VAPID");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ title: "Permiso denegado", description: "Necesitás permitir notificaciones en tu navegador.", variant: "destructive" });
        setToggling(false);
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidJson.publicKey),
      });

      const subJson = subscription.toJSON();
      const saveData = await pushFetch("subscribe", "POST", {
        userId: user.id,
        subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
      });
      if (saveData.error) throw new Error(saveData.error);

      setSubscribed(true);
      toast({ title: "Notificaciones push activadas", description: "Recibirás alertas incluso con la pestaña cerrada." });
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast({ title: "Error", description: err.message || "No se pudo activar push", variant: "destructive" });
    }
    setToggling(false);
  };

  const unsubscribe = async () => {
    if (!user) return;
    setToggling(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await pushFetch("unsubscribe", "POST", { userId: user.id, endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
      toast({ title: "Notificaciones push desactivadas" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setToggling(false);
  };

  if (!supported) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-muted-foreground" />
            Notificaciones Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tu navegador no soporta notificaciones push.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2 text-base">
          {subscribed ? (
            <BellRing className="w-5 h-5 text-primary" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
          Notificaciones Push del navegador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {subscribed
            ? "Las notificaciones push están activas. Recibirás alertas incluso con la pestaña cerrada."
            : "Activá las notificaciones push para recibir alertas de nuevas reservas incluso cuando no tengas la app abierta."}
        </p>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <Button
            variant={subscribed ? "outline" : "default"}
            size="sm"
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={toggling}
          >
            {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {subscribed ? "Desactivar push" : "Activar notificaciones push"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
