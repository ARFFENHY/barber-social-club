import { useState } from "react";
import { format, startOfWeek, startOfMonth, addDays, isSameDay } from "date-fns";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarIcon, Scissors, Users, BarChart3, Clock, ArrowLeft, X,
  TrendingUp, CheckCircle, Eye, Phone, MessageCircle, Settings, Edit, Trash2, History,
  UserCheck, RefreshCw, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AdminScheduleSettings from "@/components/AdminScheduleSettings";
import AdminBlockedSlots from "@/components/AdminBlockedSlots";
import AdminEditAppointment from "@/components/AdminEditAppointment";
import AdminServices from "@/components/AdminServices";
import AdminContentManager from "@/components/AdminContentManager";
import NotificationBell from "@/components/NotificationBell";

type ViewMode = "day" | "week";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  confirmed: { label: "Confirmada", class: "bg-blue-900/30 text-blue-400 border-blue-800" },
  completed: { label: "Completada", class: "bg-green-900/30 text-green-400 border-green-800" },
  cancelled: { label: "Cancelada", class: "bg-destructive/20 text-destructive border-destructive/50" },
  pending: { label: "Pendiente", class: "bg-yellow-900/30 text-yellow-400 border-yellow-800" },
};

function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [barberFilter, setBarberFilter] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Appointments for the week
  const { data: weekAppts } = useQuery({
    queryKey: ["admin_week_appointments", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price, duration_minutes)")
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("time");
      if (error) throw error;
      const userIds = [...new Set(data?.map((a) => a.user_id) || [])];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      return data?.map((a) => ({ ...a, profile: profileMap.get(a.user_id) || null })) || [];
    },
  });

  // All appointments (for history)
  const { data: allAppointments } = useQuery({
    queryKey: ["admin_all_appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price, duration_minutes)")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(200);
      if (error) throw error;
      const userIds = [...new Set(data?.map((a) => a.user_id) || [])];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      return data?.map((a) => ({ ...a, profile: profileMap.get(a.user_id) || null })) || [];
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

  // Client appointment history
  const { data: clientHistory } = useQuery({
    queryKey: ["admin_client_history", selectedClient],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price)")
        .eq("user_id", selectedClient!)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient,
  });

  // All appointments for client counts
  const { data: allAppointmentCounts } = useQuery({
    queryKey: ["admin_appointment_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("user_id, status")
        .neq("status", "cancelled");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((a) => { counts[a.user_id] = (counts[a.user_id] || 0) + 1; });
      return counts;
    },
  });

  // Earnings data
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const { data: allEarnings } = useQuery({
    queryKey: ["admin_earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earnings")
        .select("*, barbers(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin_week_appointments"] });
    queryClient.invalidateQueries({ queryKey: ["admin_all_appointments"] });
    queryClient.invalidateQueries({ queryKey: ["admin_client_history"] });
    queryClient.invalidateQueries({ queryKey: ["admin_appointment_counts"] });
    queryClient.invalidateQueries({ queryKey: ["admin_earnings"] });
  };

  const sendNotification = async (userId: string, appointmentId: string, type: string, message: string) => {
    await supabase.from("notifications").insert({
      user_id: userId,
      appointment_id: appointmentId,
      type,
      message,
    });
  };

  const updateStatus = async (apt: any, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", apt.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Auto-insert earning when completed
    if (status === "completed") {
      const amount = (apt.services as any)?.price || apt.payment_amount || 0;
      await supabase.from("earnings").insert({
        barber_id: apt.barber_id,
        appointment_id: apt.id,
        amount,
        date: apt.date,
      });
    }
    const statusLabel = STATUS_CONFIG[status]?.label || status;
    await sendNotification(
      apt.user_id, apt.id, `appointment_${status}`,
      `Tu cita del ${format(new Date(apt.date + "T12:00:00"), "d MMM", { locale: es })} a las ${apt.time.slice(0, 5)} fue marcada como: ${statusLabel}.`
    );
    toast({ title: `Cita ${statusLabel.toLowerCase()}` });
    invalidateAll();
  };

  const deleteAppointment = async (apt: any) => {
    const { error } = await supabase.from("appointments").delete().eq("id", apt.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await sendNotification(
      apt.user_id, apt.id, "appointment_deleted",
      `Tu cita del ${format(new Date(apt.date + "T12:00:00"), "d MMM", { locale: es })} a las ${apt.time.slice(0, 5)} con ${(apt.barbers as any)?.name} fue eliminada.`
    );
    toast({ title: "Cita eliminada" });
    invalidateAll();
  };

  // Filtered appointments
  const filteredWeekAppts = weekAppts?.filter((a) => {
    if (a.status === "cancelled") return false;
    if (barberFilter && a.barber_id !== barberFilter) return false;
    return true;
  });

  const todayAppts = filteredWeekAppts?.filter((a) => a.date === dateStr);
  const todayCount = todayAppts?.length || 0;
  const weekCount = filteredWeekAppts?.length || 0;

  const barberStats = barbers?.map((b) => ({
    name: b.name, id: b.id,
    count: weekAppts?.filter((a) => a.barber_id === b.id && a.status !== "cancelled").length || 0,
  })).sort((a, b) => b.count - a.count);

  const totalRevenue = filteredWeekAppts?.reduce((sum, a) => sum + (a.payment_amount || 0), 0) || 0;

  // History: completed + cancelled
  const historyAppts = allAppointments?.filter((a) => a.status === "completed" || a.status === "cancelled") || [];

  const AppointmentCard = ({ apt }: { apt: any }) => {
    const statusCfg = STATUS_CONFIG[apt.status] || { label: apt.status, class: "" };
    return (
      <Card className="border-border hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-primary font-bold text-lg">{apt.time.slice(0, 5)}</span>
                <span className="font-semibold">{(apt.services as any)?.name}</span>
                <Badge variant="outline" className={cn("text-xs", statusCfg.class)}>
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {apt.profile?.full_name || "Sin nombre"}
                </span>
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  {(apt.barbers as any)?.name}
                </span>
                {apt.profile?.phone && (
                  <a
                    href={`https://wa.me/54${apt.profile.phone.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="w-3 h-3" />{apt.profile.phone}
                  </a>
                )}
                <span className="text-primary font-medium">
                  ${(apt.services as any)?.price?.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0 flex-wrap">
              {/* Confirm */}
              {(apt.status === "pending" || apt.status === "confirmed") && apt.status !== "completed" && (
                <>
                  {apt.status === "pending" && (
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                      onClick={() => updateStatus(apt, "confirmed")} title="Confirmar">
                      <UserCheck className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                    onClick={() => updateStatus(apt, "completed")} title="Completada">
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingAppointment(apt)} title="Editar">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Cancelar">
                        <X className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {apt.profile?.full_name} — {(apt.services as any)?.name} a las {apt.time.slice(0, 5)} con {(apt.barbers as any)?.name}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, mantener</AlertDialogCancel>
                        <AlertDialogAction onClick={() => updateStatus(apt, "cancelled")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Sí, cancelar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive hover:bg-destructive/10" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar esta cita permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará la cita de {apt.profile?.full_name} del {format(new Date(apt.date + "T12:00:00"), "d MMM", { locale: es })} a las {apt.time.slice(0, 5)}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteAppointment(apt)} className="bg-destructive text-destructive-foreground">
                      Eliminar definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="bg-muted flex-wrap h-auto gap-1">
          <TabsTrigger value="calendar"><CalendarIcon className="w-4 h-4 mr-1" />Calendario</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1" />Estadísticas</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-1" />Historial</TabsTrigger>
          <TabsTrigger value="clients"><Users className="w-4 h-4 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Configuración</TabsTrigger>
          <TabsTrigger value="content"><Type className="w-4 h-4 mr-1" />Contenido</TabsTrigger>
        </TabsList>

        {/* ===================== CALENDARIO ===================== */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "d MMM yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <div className="flex bg-muted rounded-lg p-0.5">
                <Button variant={viewMode === "day" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("day")}>Día</Button>
                <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("week")}>Semana</Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={barberFilter === null ? "default" : "outline"} size="sm" onClick={() => setBarberFilter(null)}>Todos</Button>
              {barbers?.map((b) => (
                <Button key={b.id} variant={barberFilter === b.id ? "default" : "outline"} size="sm" onClick={() => setBarberFilter(b.id)}>
                  {b.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{weekCount}</p>
                <p className="text-xs text-muted-foreground">Esta semana</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString("es-AR")}</p>
                <p className="text-xs text-muted-foreground">Ingresos semana</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{allClients?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Clientes totales</p>
              </CardContent>
            </Card>
          </div>

          {/* Day View */}
          {viewMode === "day" && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-lg">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                <span className="text-muted-foreground font-normal text-sm ml-2">({todayCount} citas)</span>
              </h3>
              {todayCount === 0 && <p className="text-muted-foreground py-8 text-center">No hay citas para este día.</p>}
              {todayAppts?.map((apt) => <AppointmentCard key={apt.id} apt={apt} />)}
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="space-y-6">
              {weekDays.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayAppts = filteredWeekAppts?.filter((a) => a.date === dayStr) || [];
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={dayStr}>
                    <h3 className={cn("font-display font-semibold text-lg mb-3 flex items-center gap-2", isToday && "text-primary")}>
                      {format(day, "EEEE d", { locale: es })}
                      {isToday && <Badge variant="default" className="text-xs">Hoy</Badge>}
                      <span className="text-muted-foreground font-normal text-sm">({dayAppts.length})</span>
                    </h3>
                    {dayAppts.length === 0 ? (
                      <p className="text-muted-foreground text-sm pl-2 pb-2">Sin citas</p>
                    ) : (
                      <div className="space-y-2">
                        {dayAppts.map((apt) => <AppointmentCard key={apt.id} apt={apt} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===================== ESTADÍSTICAS ===================== */}
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
                <p className="text-3xl font-bold text-primary">${totalRevenue.toLocaleString("es-AR")}</p>
                <p className="text-sm text-muted-foreground">Ingresos semana</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-3xl font-bold">{allClients?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Clientes totales</p>
              </CardContent>
            </Card>
          </div>

          {/* Earnings per barber */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Ingresos por barbero
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barbers?.map((b) => {
                const barberEarnings = allEarnings?.filter((e) => e.barber_id === b.id) || [];
                const todayTotal = barberEarnings.filter((e) => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0);
                const weekTotal = barberEarnings.filter((e) => e.date >= thisWeekStart).reduce((s, e) => s + Number(e.amount), 0);
                const monthTotal = barberEarnings.filter((e) => e.date >= thisMonthStart).reduce((s, e) => s + Number(e.amount), 0);
                return (
                  <div key={b.id} className="mb-6 last:mb-0">
                    <h4 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-primary" />
                      {b.name}
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <p className="text-xl font-bold text-primary">${todayTotal.toLocaleString("es-AR")}</p>
                        <p className="text-xs text-muted-foreground">Hoy</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <p className="text-xl font-bold text-primary">${weekTotal.toLocaleString("es-AR")}</p>
                        <p className="text-xs text-muted-foreground">Semana</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <p className="text-xl font-bold text-primary">${monthTotal.toLocaleString("es-AR")}</p>
                        <p className="text-xs text-muted-foreground">Mes</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display">Reservas por barbero (semana)</CardTitle>
            </CardHeader>
            <CardContent>
              {barberStats?.map((b) => (
                <div key={b.name} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="font-medium">{b.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-40 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${weekCount ? (b.count / weekCount) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-mono w-8 text-right font-bold">{b.count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== HISTORIAL ===================== */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="font-display flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de citas ({historyAppts.length})
                </CardTitle>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Borrar semana
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar historial de esta semana?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán todas las citas completadas y canceladas de los últimos 7 días. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
                          const weekAgo = format(addDays(new Date(), -7), "yyyy-MM-dd");
                          const toDelete = historyAppts.filter((a) => a.date >= weekAgo);
                          for (const apt of toDelete) {
                            await supabase.from("appointments").delete().eq("id", apt.id);
                          }
                          toast({ title: `${toDelete.length} citas eliminadas` });
                          invalidateAll();
                        }}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Borrar mes
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar historial del último mes?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán todas las citas completadas y canceladas de los últimos 30 días. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
                          const monthAgo = format(addDays(new Date(), -30), "yyyy-MM-dd");
                          const toDelete = historyAppts.filter((a) => a.date >= monthAgo);
                          for (const apt of toDelete) {
                            await supabase.from("appointments").delete().eq("id", apt.id);
                          }
                          toast({ title: `${toDelete.length} citas eliminadas` });
                          invalidateAll();
                        }}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyAppts.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No hay citas en el historial.</p>
              ) : (
                <div className="space-y-2">
                  {historyAppts.map((apt) => {
                    const statusCfg = STATUS_CONFIG[apt.status] || { label: apt.status, class: "" };
                    return (
                      <div key={apt.id} className="flex items-center justify-between py-3 px-3 rounded-lg border border-border">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {format(new Date(apt.date + "T12:00:00"), "d MMM yyyy", { locale: es })}
                            </span>
                            <span className="font-mono text-primary text-sm">{apt.time.slice(0, 5)}</span>
                            <Badge variant="outline" className={cn("text-xs", statusCfg.class)}>
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {(apt as any).profile?.full_name || "Cliente"} · {(apt.services as any)?.name} · {(apt.barbers as any)?.name} · ${(apt.services as any)?.price?.toLocaleString("es-AR")}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar del historial?</AlertDialogTitle>
                              <AlertDialogDescription>Se eliminará permanentemente este registro.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>No</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteAppointment(apt)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== CLIENTES ===================== */}
        <TabsContent value="clients" className="space-y-6">
          {selectedClient ? (
            <ClientDetail
              client={allClients?.find((c) => c.user_id === selectedClient)}
              history={clientHistory}
              onBack={() => setSelectedClient(null)}
              onCancel={(id) => {
                const apt = clientHistory?.find((a) => a.id === id);
                if (apt) updateStatus(apt, "cancelled");
              }}
            />
          ) : (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display">Clientes registrados ({allClients?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {allClients?.map((client) => {
                    const count = allAppointmentCounts?.[client.user_id] || 0;
                    return (
                      <button
                        key={client.id}
                        onClick={() => setSelectedClient(client.user_id)}
                        className="w-full flex items-center justify-between py-3 px-3 rounded-lg border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium">{client.full_name || "Sin nombre"}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            {client.phone ? (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
                            ) : "Sin teléfono"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{count} citas</p>
                            <p className="text-xs text-muted-foreground">
                              Desde {format(new Date(client.created_at), "MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===================== CONFIGURACIÓN ===================== */}
        <TabsContent value="settings" className="space-y-6">
          <AdminServices />
          <AdminScheduleSettings />
          <AdminBlockedSlots />
        </TabsContent>

        {/* ===================== CONTENIDO ===================== */}
        <TabsContent value="content" className="space-y-6">
          <AdminContentManager />
        </TabsContent>
      </Tabs>

      {/* Edit appointment dialog */}
      {editingAppointment && (
        <AdminEditAppointment
          appointment={editingAppointment}
          open={!!editingAppointment}
          onOpenChange={(open) => { if (!open) setEditingAppointment(null); }}
        />
      )}
    </>
  );
}

function ClientDetail({ client, history, onBack, onCancel }: {
  client: any; history: any[] | undefined; onBack: () => void; onCancel: (id: string) => void;
}) {
  if (!client) return null;
  const phone = client.phone?.replace(/\D/g, "");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>← Volver a clientes</Button>
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-xl font-bold">{client.full_name || "Sin nombre"}</h3>
              <p className="text-muted-foreground text-sm">
                Cliente desde {format(new Date(client.created_at), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
            {phone && (
              <a href={`https://wa.me/54${phone}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm"><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</Button>
              </a>
            )}
          </div>
          {client.phone && (
            <p className="text-sm mt-2 flex items-center gap-1 text-muted-foreground">
              <Phone className="w-3 h-3" /> {client.phone}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Historial de citas ({history?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!history?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Sin citas registradas.</p>
          ) : (
            <div className="space-y-2">
              {history.map((apt) => {
                const statusCfg = STATUS_CONFIG[apt.status] || { label: apt.status, class: "" };
                return (
                  <div key={apt.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{format(new Date(apt.date + "T12:00:00"), "d MMM yyyy", { locale: es })}</span>
                        <span className="font-mono text-primary text-sm">{apt.time.slice(0, 5)}</span>
                        <Badge variant="outline" className={cn("text-xs", statusCfg.class)}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(apt.services as any)?.name} · {(apt.barbers as any)?.name} · ${(apt.services as any)?.price?.toLocaleString("es-AR")}
                      </p>
                    </div>
                    {apt.status === "confirmed" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive"><X className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {(apt.services as any)?.name} el {format(new Date(apt.date + "T12:00:00"), "d MMM", { locale: es })} a las {apt.time.slice(0, 5)}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onCancel(apt.id)} className="bg-destructive text-destructive-foreground">Cancelar cita</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
          <p className="text-muted-foreground mb-4">No tenés permisos de administrador.</p>
          <Link to="/"><Button>Volver al inicio</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Inicio
            </Link>
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-gradient-gold">Panel Admin</span>
            </div>
          </div>
          <NotificationBell />
        </div>
      </nav>
      <div className="container mx-auto px-4 pt-24 pb-12">
        <AdminDashboard />
      </div>
    </div>
  );
}
