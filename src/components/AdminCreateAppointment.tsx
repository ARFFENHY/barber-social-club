import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useBarbers, useServices, useShopSettings } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill from existing appointment (for "Crear próximo turno") */
  fromAppointment?: any;
  /** Or pre-fill just from a client profile */
  client?: { user_id: string; full_name?: string | null; phone?: string | null; visit_frequency_days?: number | null; permanent_notes?: string | null };
}

const generateSlots = (blocks: { start: string; end: string }[], duration: number) => {
  const slots: string[] = [];
  for (const b of blocks) {
    const [sh, sm] = b.start.split(":").map(Number);
    const [eh, em] = b.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + duration <= end) {
      slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
      cur += duration;
    }
  }
  return slots;
};

export default function AdminCreateAppointment({ open, onOpenChange, fromAppointment, client }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: settings } = useShopSettings();

  const sourceUserId = fromAppointment?.user_id || client?.user_id;
  const sourceProfile = fromAppointment?.profile || client;
  const freq = sourceProfile?.visit_frequency_days as number | null | undefined;

  // Suggested date: last appointment date + frequency, else today+freq, else today
  const suggestedDate = useMemo(() => {
    const base = fromAppointment?.date ? new Date(fromAppointment.date + "T12:00:00") : new Date();
    if (freq && freq > 0) return addDays(base, freq);
    return addDays(base, 7);
  }, [fromAppointment, freq]);

  const [barberId, setBarberId] = useState<string>(fromAppointment?.barber_id || "");
  const [serviceId, setServiceId] = useState<string>(fromAppointment?.service_id || "");
  const [date, setDate] = useState<Date | undefined>(suggestedDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState<string>(fromAppointment?.notes || "");
  const [saving, setSaving] = useState(false);

  const slotDuration = settings?.slot_duration?.minutes || 30;
  const scheduleBlocks: Record<number, { start: string; end: string }[]> = {};
  const schedules = settings?.working_hours?.schedules;
  if (schedules) {
    for (const s of schedules) {
      for (const d of s.days) {
        scheduleBlocks[d] = s.blocks.map((b: any) => ({ start: b.start, end: b.end }));
      }
    }
  }
  const barberDays: Record<string, number[]> = settings?.barber_schedules || {};
  const isWorkingDay = (d: Date) => {
    const day = d.getDay();
    const days = barberDays[barberId];
    return days ? days.includes(day) && !!scheduleBlocks[day] : !!scheduleBlocks[day];
  };

  const slots = (() => {
    if (!date) return [];
    const blocks = scheduleBlocks[date.getDay()];
    if (!blocks) return [];
    return generateSlots(blocks, slotDuration);
  })();

  const handleSave = async () => {
    if (!sourceUserId || !barberId || !serviceId || !date || !time) {
      toast({ title: "Completá todos los campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const service = services?.find((s) => s.id === serviceId);
      const dateStr = format(date, "yyyy-MM-dd");
      const timeStr = time + ":00";

      const { data: inserted, error } = await supabase
        .from("appointments")
        .insert({
          user_id: sourceUserId,
          barber_id: barberId,
          service_id: serviceId,
          date: dateStr,
          time: timeStr,
          status: "confirmed",
          payment_status: "pending",
          payment_amount: service?.price || 0,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: sourceUserId,
        appointment_id: inserted.id,
        type: "appointment_created",
        message: `Se agendó un turno para vos: ${format(date, "EEEE d MMM", { locale: es })} a las ${time} — ${service?.name}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin_week_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_calendar_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_client_history"] });
      queryClient.invalidateQueries({ queryKey: ["admin_appointment_counts"] });

      toast({ title: "Turno creado", description: `${sourceProfile?.full_name || "Cliente"} — ${format(date, "d MMM", { locale: es })} ${time}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            {fromAppointment ? "Crear próximo turno" : "Nuevo turno"}
          </DialogTitle>
          <DialogDescription>
            {sourceProfile?.full_name || "Cliente"}
            {sourceProfile?.phone ? ` · ${sourceProfile.phone}` : ""}
            {freq ? ` · cada ${freq} días` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={sourceProfile?.full_name || "Cliente"} disabled />
          </div>

          <div className="space-y-2">
            <Label>Barbero</Label>
            <Select value={barberId} onValueChange={(v) => { setBarberId(v); setTime(""); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar barbero" /></SelectTrigger>
              <SelectContent>
                {barbers?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
              <SelectContent>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — ${s.price.toLocaleString("es-AR")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha {freq ? <span className="text-xs text-muted-foreground">(sugerida en +{freq} días)</span> : null}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "EEEE d MMM yyyy", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setTime(""); }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || !isWorkingDay(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {date && slots.length > 0 && (
            <div className="space-y-2">
              <Label>Hora</Label>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setTime(s)}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-sm font-medium border transition-all",
                      time === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre este turno (corte, preferencias, etc.)"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Crear turno"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
