import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useBarbers, useServices, useShopSettings } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateTimeSlotsFromBlocks = (blocks: { start: string; end: string }[], duration: number) => {
  const slots: string[] = [];
  for (const block of blocks) {
    const [sh, sm] = block.start.split(":").map(Number);
    const [eh, em] = block.end.split(":").map(Number);
    let current = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (current + duration <= endMin) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += duration;
    }
  }
  return slots;
};

export default function AdminEditAppointment({ appointment, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: settings } = useShopSettings();

  const [barberId, setBarberId] = useState(appointment.barber_id);
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [date, setDate] = useState<Date | undefined>(new Date(appointment.date + "T12:00:00"));
  const [time, setTime] = useState(appointment.time.slice(0, 5));
  const [saving, setSaving] = useState(false);

  const slotDuration = settings?.slot_duration?.minutes || 30;

  const scheduleBlocks: Record<number, { start: string; end: string }[]> = {};
  const schedules = settings?.working_hours?.schedules;
  if (schedules) {
    for (const sched of schedules) {
      for (const day of sched.days) {
        scheduleBlocks[day] = sched.blocks.map((b: any) => ({ start: b.start, end: b.end }));
      }
    }
  }

  const barberDays: Record<string, number[]> = settings?.barber_schedules || {};

  const isWorkingDay = (d: Date) => {
    const day = d.getDay();
    const days = barberDays[barberId];
    return days ? days.includes(day) && !!scheduleBlocks[day] : !!scheduleBlocks[day];
  };

  const availableSlots = (() => {
    if (!date) return [];
    const dayOfWeek = date.getDay();
    const blocks = scheduleBlocks[dayOfWeek];
    if (!blocks) return [];
    return generateTimeSlotsFromBlocks(blocks, slotDuration);
  })();

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    try {
      const newDate = format(date, "yyyy-MM-dd");
      const newTime = time + ":00";
      const selectedService = services?.find((s) => s.id === serviceId);
      const selectedBarber = barbers?.find((b) => b.id === barberId);

      const { error } = await supabase
        .from("appointments")
        .update({
          barber_id: barberId,
          service_id: serviceId,
          date: newDate,
          time: newTime,
          payment_amount: selectedService?.price || appointment.payment_amount,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Create notification for the client
      const changes: string[] = [];
      if (newDate !== appointment.date) changes.push(`fecha: ${format(date, "d MMM yyyy", { locale: es })}`);
      if (newTime !== appointment.time) changes.push(`hora: ${time}`);
      if (barberId !== appointment.barber_id) changes.push(`barbero: ${selectedBarber?.name}`);
      if (serviceId !== appointment.service_id) changes.push(`servicio: ${selectedService?.name}`);

      if (changes.length > 0) {
        await supabase.from("notifications").insert({
          user_id: appointment.user_id,
          appointment_id: appointment.id,
          type: "appointment_modified",
          message: `Tu cita fue modificada: ${changes.join(", ")}. Nueva fecha: ${format(date, "d MMM", { locale: es })} a las ${time} con ${selectedBarber?.name || (appointment.barbers as any)?.name}.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin_week_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_client_history"] });
      toast({ title: "Cita actualizada" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Editar cita</DialogTitle>
          <DialogDescription>
            {appointment.profile?.full_name || "Cliente"} — {(appointment.services as any)?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barber */}
          <div className="space-y-2">
            <Label>Barbero</Label>
            <Select value={barberId} onValueChange={(v) => { setBarberId(v); setDate(undefined); setTime(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {barbers?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — ${s.price.toLocaleString("es-AR")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Fecha</Label>
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

          {/* Time */}
          {date && availableSlots.length > 0 && (
            <div className="space-y-2">
              <Label>Hora</Label>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setTime(slot)}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-sm font-medium border transition-all",
                      time === slot
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !date || !time}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
