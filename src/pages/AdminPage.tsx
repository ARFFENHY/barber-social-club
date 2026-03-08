import { useState } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBarbers, useServices } from "@/hooks/useShopData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Scissors, Users, BarChart3, Clock, ArrowLeft, X, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();

  // Today's appointments
  const { data: todayAppts } = useQuery({
    queryKey: ["admin_appointments", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price, duration_minutes), profiles!appointments_user_id_fkey(full_name, phone)")
        .eq("date", dateStr)
        .neq("status", "cancelled")
        .order("time");
      if (error) throw error;
      return data;
    },
  });

  // Weekly stats
  const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), 6), "yyyy-MM-dd");

  const { data: weekAppts } = useQuery({
    queryKey: ["admin_week_appointments", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name)")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  // All clients
  const { data: allClients } = useQuery({
    queryKey: ["admin_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Client appointments
  const { data: clientAppointments } = useQuery({
    queryKey: ["admin_all_appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price), profiles!appointments_user_id_fkey(full_name)")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Cita cancelada" });
      queryClient.invalidateQueries({ queryKey: ["admin_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_week_appointments"] });
    }
  };

  const completeAppointment = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Cita completada" });
      queryClient.invalidateQueries({ queryKey: ["admin_appointments"] });
    }
  };

  // Stats
  const todayCount = todayAppts?.length || 0;
  const weekCount = weekAppts?.length || 0;
  const barberStats = barbers?.map((b) => ({
    name: b.name,
    count: weekAppts?.filter((a) => a.barber_id === b.id).length || 0,
  })).sort((a, b) => b.count - a.count);
  const topBarber = barberStats?.[0];

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const newClientsToday = allClients?.filter((c) => c.created_at.startsWith(todayDate)).length || 0;

  return (
    <Tabs defaultValue="calendar" className="space-y-6">
      <TabsList className="bg-muted">
        <TabsTrigger value="calendar"><CalendarIcon className="w-4 h-4 mr-1" />Calendario</TabsTrigger>
        <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1" />Estadísticas</TabsTrigger>
        <TabsTrigger value="clients"><Users className="w-4 h-4 mr-1" />Clientes</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE d MMMM", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-3">
          {todayAppts?.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No hay citas para este día.</p>
          )}
          {todayAppts?.map((apt) => (
            <Card key={apt.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary font-bold">{apt.time.slice(0, 5)}</span>
                      <span className="font-semibold">{(apt.services as any)?.name}</span>
                      <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>{apt.status === "confirmed" ? "Confirmada" : apt.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cliente: {(apt as any).profiles?.full_name || "—"} · Barbero: {(apt.barbers as any)?.name}
                      {(apt as any).profiles?.phone && ` · Tel: ${(apt as any).profiles.phone}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {apt.status === "confirmed" && (
                      <>
                        <Button variant="ghost" size="sm" className="text-primary" onClick={() => completeAppointment(apt.id)}>✓</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelAppointment(apt.id)}><X className="w-4 h-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="stats" className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-3xl font-bold">{todayCount}</p>
              <p className="text-sm text-muted-foreground">Citas hoy</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <CalendarIcon className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-3xl font-bold">{weekCount}</p>
              <p className="text-sm text-muted-foreground">Esta semana</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-3xl font-bold">{topBarber?.name || "—"}</p>
              <p className="text-sm text-muted-foreground">Más reservas ({topBarber?.count || 0})</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-3xl font-bold">{newClientsToday}</p>
              <p className="text-sm text-muted-foreground">Clientes nuevos hoy</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-display">Reservas por barbero (semana)</CardTitle>
          </CardHeader>
          <CardContent>
            {barberStats?.map((b) => (
              <div key={b.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="font-medium">{b.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${weekCount ? (b.count / weekCount) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-mono w-6 text-right">{b.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="clients" className="space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-display">Clientes registrados ({allClients?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allClients?.map((client) => {
                const clientAppts = clientAppointments?.filter((a) => a.user_id === client.user_id) || [];
                return (
                  <div key={client.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium">{client.full_name || "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground">{client.phone || "Sin teléfono"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{clientAppts.length} citas</p>
                      <p className="text-xs text-muted-foreground">Desde {format(new Date(client.created_at), "MMM yyyy", { locale: es })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando...</div>;
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Acceso denegado</h1>
          <p className="text-muted-foreground mb-4">No tienes permisos de administrador.</p>
          <Link to="/"><Button>Volver al inicio</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Inicio
          </Link>
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-gradient-gold">Admin</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-24 pb-12">
        <AdminDashboard />
      </div>
    </div>
  );
}
