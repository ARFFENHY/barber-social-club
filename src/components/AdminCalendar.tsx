import { useState, useEffect } from "react";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths,
  subDays, subWeeks, subMonths, isSameDay, isSameMonth, eachDayOfInterval, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBarbers } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, CalendarIcon, Scissors, Users,
  CheckCircle, X, Edit, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AdminEditAppointment from "@/components/AdminEditAppointment";

type ViewMode = "day" | "week" | "month";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  confirmed: { label: "Confirmada", class: "bg-blue-900/30 text-blue-400 border-blue-800" },
  completed: { label: "Completada", class: "bg-green-900/30 text-green-400 border-green-800" },
  cancelled: { label: "Cancelada", class: "bg-destructive/20 text-destructive border-destructive/50" },
  pending: { label: "Pendiente", class: "bg-yellow-900/30 text-yellow-400 border-yellow-800" },
};

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();

  // Calculate date range based on view
  const getRange = () => {
    if (viewMode === "day") return { start: currentDate, end: currentDate };
    if (viewMode === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      return { start: s, end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const range = getRange();
  const startStr = format(range.start, "yyyy-MM-dd");
  const endStr = format(range.end, "yyyy-MM-dd");

  const { data: appointments } = useQuery({
    queryKey: ["admin_calendar_appointments", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price, duration_minutes)")
        .gte("date", startStr)
        .lte("date", endStr)
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-calendar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin_calendar_appointments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const navigate = (dir: number) => {
    if (viewMode === "day") setCurrentDate((d) => dir > 0 ? addDays(d, 1) : subDays(d, 1));
    if (viewMode === "week") setCurrentDate((d) => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    if (viewMode === "month") setCurrentDate((d) => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const updateStatus = async (apt: any, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", apt.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (status === "completed") {
      const amount = (apt.services as any)?.price || apt.payment_amount || 0;
      await supabase.from("earnings").insert({ barber_id: apt.barber_id, appointment_id: apt.id, amount, date: apt.date });
    }
    const label = STATUS_CONFIG[status]?.label || status;
    await supabase.from("notifications").insert({
      user_id: apt.user_id, appointment_id: apt.id, type: `appointment_${status}`,
      message: `Tu cita del ${format(parseISO(apt.date), "d MMM", { locale: es })} a las ${apt.time.slice(0, 5)} fue marcada como: ${label}.`,
    });
    toast({ title: `Cita ${label.toLowerCase()}` });
    setSelectedAppointment(null);
    queryClient.invalidateQueries({ queryKey: ["admin_calendar_appointments"] });
    queryClient.invalidateQueries({ queryKey: ["admin_week_appointments"] });
    queryClient.invalidateQueries({ queryKey: ["admin_all_appointments"] });
  };

  const getAptsForDay = (date: Date): any[] => {
    const ds = format(date, "yyyy-MM-dd");
    return appointments?.filter((a) => a.date === ds && a.status !== "cancelled") || [];
  };

  const headerLabel = () => {
    if (viewMode === "day") return format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });
    if (viewMode === "week") {
      return `${format(range.start, "d MMM", { locale: es })} — ${format(range.end, "d MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: es });
  };

  const days = eachDayOfInterval({ start: range.start, end: range.end });

  // Appointment mini card
  const AptChip = ({ apt }: { apt: any }) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
    const cfg = STATUS_CONFIG[apt.status] || { label: apt.status, class: "" };
    return (
      <button
        onClick={() => setSelectedAppointment(apt)}
        className={cn(
          "w-full text-left px-2 py-1 rounded-md text-xs border transition-colors hover:opacity-80 truncate",
          cfg.class
        )}
      >
        <span className="font-mono font-bold">{apt.time.slice(0, 5)}</span>{" "}
        <span className="truncate">{apt.profile?.full_name || "Cliente"}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-display font-semibold text-lg capitalize min-w-0">{headerLabel()}</h3>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((m) => (
            <Button key={m} variant={viewMode === m ? "default" : "ghost"} size="sm" onClick={() => setViewMode(m)}>
              {m === "day" ? "Día" : m === "week" ? "Semana" : "Mes"}
            </Button>
          ))}
        </div>
      </div>

      {/* Day View */}
      {viewMode === "day" && (
        <div className="space-y-2">
          {getAptsForDay(currentDate).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay citas para este día.</p>
          ) : (
            getAptsForDay(currentDate).map((apt) => (
              <Card key={apt.id} className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedAppointment(apt)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="font-mono text-primary font-bold text-lg">{apt.time.slice(0, 5)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{apt.profile?.full_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(apt.services as any)?.name} · {(apt.barbers as any)?.name}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_CONFIG[apt.status]?.class)}>
                    {STATUS_CONFIG[apt.status]?.label}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="space-y-4">
          {days.map((day) => {
            const dayAppts = getAptsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()}>
                <h4 className={cn("font-display font-semibold mb-2 flex items-center gap-2", isToday && "text-primary")}>
                  {format(day, "EEEE d", { locale: es })}
                  {isToday && <Badge variant="default" className="text-xs">Hoy</Badge>}
                  <span className="text-muted-foreground font-normal text-sm">({dayAppts.length})</span>
                </h4>
                {dayAppts.length === 0 ? (
                  <p className="text-muted-foreground text-sm pl-2 pb-1">Sin citas</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayAppts.map((apt) => (
                      <Card key={apt.id} className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedAppointment(apt)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <span className="font-mono text-primary font-bold">{apt.time.slice(0, 5)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{apt.profile?.full_name || "Cliente"}</p>
                            <p className="text-xs text-muted-foreground truncate">{(apt.services as any)?.name} · {(apt.barbers as any)?.name}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_CONFIG[apt.status]?.class)}>
                            {STATUS_CONFIG[apt.status]?.label}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === "month" && (() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
        const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        return (
          <div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {dayNames.map((d) => (
                <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {calDays.map((day) => {
                const dayAppts = getAptsForDay(day);
                const isToday = isSameDay(day, new Date());
                const inMonth = isSameMonth(day, currentDate);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "bg-card min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 transition-colors",
                      !inMonth && "opacity-40",
                      isToday && "ring-1 ring-primary ring-inset"
                    )}
                  >
                    <p className={cn("text-xs font-medium mb-1", isToday ? "text-primary font-bold" : "text-muted-foreground")}>
                      {format(day, "d")}
                    </p>
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 3).map((apt) => <AptChip key={apt.id} apt={apt} />)}
                      {dayAppts.length > 3 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{dayAppts.length - 3} más</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Appointment Detail Dialog */}
      {selectedAppointment && !editingAppointment && (
        <Dialog open={!!selectedAppointment} onOpenChange={(o) => { if (!o) setSelectedAppointment(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Detalle de cita</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p className="font-medium flex items-center gap-1"><Users className="w-3 h-3" />{selectedAppointment.profile?.full_name || "Sin nombre"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Barbero</p>
                  <p className="font-medium flex items-center gap-1"><Scissors className="w-3 h-3" />{(selectedAppointment.barbers as any)?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Servicio</p>
                  <p className="font-medium">{(selectedAppointment.services as any)?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Precio</p>
                  <p className="font-medium text-primary">${(selectedAppointment.services as any)?.price?.toLocaleString("es-AR")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="font-medium flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(parseISO(selectedAppointment.date), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hora</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedAppointment.time.slice(0, 5)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Teléfono</p>
                  <p className="font-medium">
                    {selectedAppointment.profile?.phone ? (
                      <a
                        href={`https://wa.me/54${selectedAppointment.profile.phone.replace(/\D/g, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedAppointment.profile.phone}
                      </a>
                    ) : "Sin teléfono"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <Badge variant="outline" className={cn("mt-1", STATUS_CONFIG[selectedAppointment.status]?.class)}>
                    {STATUS_CONFIG[selectedAppointment.status]?.label}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              {selectedAppointment.status !== "cancelled" && selectedAppointment.status !== "completed" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button size="sm" className="flex-1" onClick={() => updateStatus(selectedAppointment, "completed")}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Completada
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                    setEditingAppointment(selectedAppointment);
                    setSelectedAppointment(null);
                  }}>
                    <Edit className="w-4 h-4 mr-1" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => setCancelTarget(selectedAppointment)}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.profile?.full_name} — {(cancelTarget?.services as any)?.name} a las {cancelTarget?.time?.slice(0, 5)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (cancelTarget) updateStatus(cancelTarget, "cancelled");
              setCancelTarget(null);
            }}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      {editingAppointment && (
        <AdminEditAppointment
          appointment={editingAppointment}
          open={!!editingAppointment}
          onOpenChange={(open) => { if (!open) setEditingAppointment(null); }}
        />
      )}
    </div>
  );
}
