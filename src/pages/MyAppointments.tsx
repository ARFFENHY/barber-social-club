import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAppointments } from "@/hooks/useShopData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, Scissors, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import NotificationBell from "@/components/NotificationBell";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "default" },
  completed: { label: "Completada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  no_show: { label: "No asistió", variant: "outline" },
};

export default function MyAppointments() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useMyAppointments(user?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cita cancelada" });
      queryClient.invalidateQueries({ queryKey: ["my_appointments"] });
    }
  };

  const upcoming = appointments?.filter((a) => a.status === "confirmed" && a.date >= format(new Date(), "yyyy-MM-dd")) || [];
  const past = appointments?.filter((a) => a.status !== "confirmed" || a.date < format(new Date(), "yyyy-MM-dd")) || [];

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
                  {upcoming.map((apt) => (
                    <Card key={apt.id} className="border-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{(apt.services as any)?.name}</h3>
                              <Badge variant={statusLabels[apt.status]?.variant}>{statusLabels[apt.status]?.label}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(apt.date + "T00:00:00"), "d MMM yyyy", { locale: es })}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{apt.time.slice(0, 5)}</span>
                              <span className="flex items-center gap-1"><Scissors className="w-3.5 h-3.5" />{(apt.barbers as any)?.name}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => cancelAppointment(apt.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{(apt.services as any)?.name}</h3>
                          <Badge variant={statusLabels[apt.status]?.variant}>{statusLabels[apt.status]?.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
    </div>
  );
}
