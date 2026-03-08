import { useState } from "react";
import { format, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAppointments } from "@/hooks/useShopData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, Scissors, X, Pencil, MessageCircle, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import NotificationBell from "@/components/NotificationBell";
import ClientEditAppointment from "@/components/ClientEditAppointment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const WHATSAPP_URL = "https://wa.me/5491170055858";
const PHONE_DISPLAY = "11 7005-5858";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "default" },
  completed: { label: "Completada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  no_show: { label: "No asistió", variant: "outline" },
};

function canModify(date: string, time: string): boolean {
  const aptDate = new Date(`${date}T${time}`);
  return differenceInHours(aptDate, new Date()) >= 24;
}

async function notifyAdmins(appointmentId: string, message: string) {
  // Get admin user IDs
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  
  if (adminRoles && adminRoles.length > 0) {
    const notifications = adminRoles.map((r) => ({
      user_id: r.user_id,
      appointment_id: appointmentId,
      type: "client_action",
      message,
    }));
    await supabase.from("notifications").insert(notifications);
  }
}

export default function MyAppointments() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useMyAppointments(user?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingAppointment, setEditingAppointment] = useState<any>(null);

  const cancelAppointment = async (apt: any) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", apt.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const clientName = user?.user_metadata?.full_name || "Un cliente";
      await notifyAdmins(
        apt.id,
        `${clientName} canceló su cita del ${format(new Date(apt.date + "T00:00:00"), "d MMM", { locale: es })} a las ${apt.time.slice(0, 5)} (${(apt.services as any)?.name} con ${(apt.barbers as any)?.name}).`
      );
      toast({ title: "Cita cancelada" });
      queryClient.invalidateQueries({ queryKey: ["my_appointments"] });
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const upcoming = appointments?.filter(
    (a) => (a.status === "confirmed" || a.status === "pending") && a.date >= today
  ) || [];
  const past = appointments?.filter(
    (a) => a.status === "completed" || a.status === "cancelled" || a.status === "no_show" || a.date < today
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Inicio
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link to="/reservar">
              <Button size="sm">Nueva Reserva</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <h1 className="text-3xl font-display font-bold mb-8 text-gradient-gold">Mis Citas</h1>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : appointments?.length === 0 ? (
          <div className="text-center py-12">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No tienes citas aún.</p>
            <Link to="/reservar"><Button>Reservar Turno</Button></Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Próximas citas</h2>
                <div className="space-y-3">
                  {upcoming.map((apt) => {
                    const modifiable = canModify(apt.date, apt.time);
                    return (
                      <Card key={apt.id} className="border-border hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">{(apt.services as any)?.name}</h3>
                                <Badge variant={statusLabels[apt.status]?.variant}>{statusLabels[apt.status]?.label}</Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(apt.date + "T00:00:00"), "d MMM yyyy", { locale: es })}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{apt.time.slice(0, 5)}</span>
                                <span className="flex items-center gap-1"><Scissors className="w-3.5 h-3.5" />{(apt.barbers as any)?.name}</span>
                              </div>
                            </div>
                          </div>

                          {modifiable ? (
                            <div className="flex gap-2 mt-3">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingAppointment(apt)}>
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Modificar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se cancelará tu cita del {format(new Date(apt.date + "T00:00:00"), "d 'de' MMMM", { locale: es })} a las {apt.time.slice(0, 5)}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Volver</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => cancelAppointment(apt)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Sí, cancelar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <div className="text-sm">
                                  <p className="text-muted-foreground">No se puede modificar ni cancelar porque faltan menos de 24 horas.</p>
                                  <p className="text-muted-foreground mt-1">Para cancelar, comunicáte con la barbería:</p>
                                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-1.5 text-primary font-medium hover:underline">
                                    <MessageCircle className="w-4 h-4" /> {PHONE_DISPLAY}
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Historial</h2>
                <div className="space-y-3">
                  {past.map((apt) => (
                    <Card key={apt.id} className="border-border opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">{(apt.services as any)?.name}</h3>
                          <Badge variant={statusLabels[apt.status]?.variant}>{statusLabels[apt.status]?.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>{format(new Date(apt.date + "T00:00:00"), "d MMM yyyy", { locale: es })}</span>
                          <span>{apt.time.slice(0, 5)}</span>
                          <span>{(apt.barbers as any)?.name}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingAppointment && (
        <ClientEditAppointment
          appointment={editingAppointment}
          open={!!editingAppointment}
          onOpenChange={(open) => { if (!open) setEditingAppointment(null); }}
        />
      )}
    </div>
  );
}
