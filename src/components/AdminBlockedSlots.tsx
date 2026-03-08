import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbers, useBlockedSlots } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2, Ban, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminBlockedSlots() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();
  const { data: blockedSlots } = useBlockedSlots();

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [allDay, setAllDay] = useState(true);
  const [timeStart, setTimeStart] = useState("10:00");
  const [timeEnd, setTimeEnd] = useState("20:00");
  const [reason, setReason] = useState("");
  const [barberId, setBarberId] = useState<string>("all");

  const resetForm = () => {
    setDate(undefined);
    setAllDay(true);
    setTimeStart("10:00");
    setTimeEnd("20:00");
    setReason("");
    setBarberId("all");
    setAdding(false);
  };

  const handleAdd = async () => {
    if (!date) {
      toast({ title: "Seleccioná una fecha", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("blocked_slots").insert({
        date: format(date, "yyyy-MM-dd"),
        all_day: allDay,
        time_start: allDay ? null : timeStart,
        time_end: allDay ? null : timeEnd,
        reason: reason || null,
        barber_id: barberId === "all" ? null : barberId,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
      toast({ title: "Bloqueo agregado" });
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
      toast({ title: "Bloqueo eliminado" });
    }
  };

  const sortedSlots = blockedSlots?.slice().sort((a, b) => a.date.localeCompare(b.date)) || [];

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" />
            Bloqueos de horarios
          </CardTitle>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Agregar bloqueo
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          {adding && (
            <Card className="border-primary/30 bg-muted/30">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "d MMM yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Barber */}
                  <div className="space-y-2">
                    <Label>Barbero</Label>
                    <Select value={barberId} onValueChange={setBarberId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los barberos</SelectItem>
                        {barbers?.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* All day toggle */}
                <div className="flex items-center gap-3">
                  <Switch checked={allDay} onCheckedChange={setAllDay} />
                  <Label>Día completo</Label>
                </div>

                {/* Time range */}
                {!allDay && (
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-32" />
                    </div>
                    <span className="text-muted-foreground mt-5">a</span>
                    <div className="space-y-1">
                      <Label className="text-xs">Hasta</Label>
                      <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-32" />
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Input
                    placeholder="Ej: Feriado, evento, vacaciones..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar bloqueo"}
                  </Button>
                  <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* List */}
          {sortedSlots.length === 0 && !adding && (
            <p className="text-muted-foreground text-sm text-center py-6">No hay bloqueos configurados.</p>
          )}
          {sortedSlots.map((slot) => {
            const barberName = slot.barber_id
              ? barbers?.find((b) => b.id === slot.barber_id)?.name || "Barbero"
              : "Todos";
            const isPast = new Date(slot.date + "T23:59:59") < new Date();
            return (
              <div
                key={slot.id}
                className={cn(
                  "flex items-center justify-between py-3 px-3 rounded-lg border border-border",
                  isPast && "opacity-50"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {format(new Date(slot.date + "T12:00:00"), "EEEE d MMM yyyy", { locale: es })}
                    </span>
                    <Badge variant="secondary" className="text-xs">{barberName}</Badge>
                    {slot.all_day ? (
                      <Badge variant="destructive" className="text-xs">Día completo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {slot.time_start?.slice(0, 5)} - {slot.time_end?.slice(0, 5)}
                      </Badge>
                    )}
                  </div>
                  {slot.reason && (
                    <p className="text-sm text-muted-foreground">{slot.reason}</p>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este bloqueo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {format(new Date(slot.date + "T12:00:00"), "d MMM yyyy", { locale: es })} — {barberName}
                        {slot.reason && ` — ${slot.reason}`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(slot.id)} className="bg-destructive text-destructive-foreground">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
