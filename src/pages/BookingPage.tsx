import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useBarbers, useServices, useAppointments, useBlockedSlots, useShopSettings } from "@/hooks/useShopData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Scissors, ArrowLeft, Check, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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



export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: settings } = useShopSettings();

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const { data: appointments } = useAppointments(dateStr, selectedBarber || undefined);
  const { data: blockedSlots } = useBlockedSlots(dateStr);

  const slotDuration = settings?.slot_duration?.minutes || 30;
  const selectedServiceData = services?.find((s) => s.id === selectedService);

  // Parse schedule from settings
  const scheduleBlocks = useMemo(() => {
    const blocks: Record<number, { start: string; end: string }[]> = {};
    const schedules = settings?.working_hours?.schedules;
    if (schedules) {
      for (const sched of schedules) {
        for (const day of sched.days) {
          blocks[day] = sched.blocks.map((b: any) => ({ start: b.start, end: b.end }));
        }
      }
    }
    return blocks;
  }, [settings]);

  const barberDays: Record<string, number[]> = useMemo(() => {
    return settings?.barber_schedules || {};
  }, [settings]);

  const availableBarbers = useMemo(() => {
    if (!barbers) return [];
    return barbers;
  }, [barbers]);

  // Generate time slots based on selected date's schedule
  const allSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dayOfWeek = selectedDate.getDay();
    const blocks = scheduleBlocks[dayOfWeek];
    if (!blocks) return [];
    return generateTimeSlotsFromBlocks(blocks, slotDuration);
  }, [selectedDate, slotDuration, scheduleBlocks]);

  const bookedTimes = new Set(appointments?.map((a) => a.time.slice(0, 5)) || []);
  const blockedTimes = new Set<string>();
  blockedSlots?.forEach((b) => {
    if (b.barber_id === selectedBarber || !b.barber_id) {
      if (b.all_day) {
        allSlots.forEach((s) => blockedTimes.add(s));
      } else if (b.time_start && b.time_end) {
        allSlots.forEach((s) => {
          if (s >= b.time_start! && s < b.time_end!) blockedTimes.add(s);
        });
      }
    }
  });

  const availableSlots = allSlots.filter((s) => !bookedTimes.has(s) && !blockedTimes.has(s));

  const isWorkingDay = (date: Date) => {
    if (!selectedBarber) return false;
    const day = date.getDay();
    const days = barberDays[selectedBarber];
    // Barber must work that day AND shop must be open
    return days ? days.includes(day) && !!scheduleBlocks[day] : false;
  };

  const handleBook = async () => {
    if (!user || !selectedService || !selectedBarber || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        barber_id: selectedBarber,
        service_id: selectedService,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime + ":00",
        payment_amount: selectedServiceData?.price || 0,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Horario no disponible", description: "Ese turno ya fue reservado.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      // Notify admins about new booking
      const clientName = user?.user_metadata?.full_name || "Un cliente";
      const barberName = barbers?.find((b) => b.id === selectedBarber)?.name || "";
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map((r) => ({
          user_id: r.user_id,
          type: "client_action",
          message: `${clientName} reservó un turno: ${selectedServiceData?.name} el ${format(selectedDate, "d MMM", { locale: es })} a las ${selectedTime} con ${barberName}.`,
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast({ title: "¡Turno reservado!", description: `${format(selectedDate, "EEEE d 'de' MMMM", { locale: es })} a las ${selectedTime}` });
      navigate("/mis-citas");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: "Servicio" },
    { num: 2, label: "Barbero" },
    { num: 3, label: "Fecha y Hora" },
    { num: 4, label: "Confirmar" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <a href="https://wa.me/5491170055858" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <MessageCircle className="w-4 h-4" />
            11 7005-5858
          </a>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step > s.num ? "bg-primary text-primary-foreground" : step === s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("w-12 sm:w-20 h-0.5 mx-1", step > s.num ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Service */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-bold mb-6">Elegí un servicio</h2>
            <div className="grid gap-3">
              {services?.map((service) => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedService(service.id); setStep(2); }}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all hover:border-primary/50",
                    selectedService === service.id ? "border-primary bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">{service.description} · {service.duration_minutes} min</p>
                    </div>
                    <span className="text-primary font-bold text-lg">${service.price.toLocaleString("es-AR")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Barber */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-bold mb-6">Elegí tu barbero</h2>
            <div className="grid grid-cols-2 gap-4">
              {availableBarbers?.map((barber) => {
                const days = barberDays[barber.id] || [];
                const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                const dayLabels = days.map((d: number) => DAY_NAMES[d]).join(", ");
                return (
                  <button
                    key={barber.id}
                    onClick={() => { setSelectedBarber(barber.id); setSelectedDate(undefined); setSelectedTime(null); setStep(3); }}
                    className={cn(
                      "p-6 rounded-xl border text-center transition-all hover:border-primary/50",
                      selectedBarber === barber.id ? "border-primary bg-primary/5 glow-gold" : "border-border bg-card"
                    )}
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Scissors className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg">{barber.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{dayLabels}</p>
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => setStep(1)}>← Atrás</Button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-bold mb-6">Fecha y hora</h2>
            <div className="space-y-6">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es }) : "Seleccioná una fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || !isWorkingDay(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {selectedDate && (
                <div>
                  <h3 className="font-medium mb-3">Horarios disponibles</h3>
                  {availableSlots.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay horarios disponibles para esta fecha.</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => { setSelectedTime(slot); setStep(4); }}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                            selectedTime === slot ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => setStep(2)}>← Atrás</Button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && selectedDate && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-bold mb-6">Confirmar reserva</h2>
            <Card className="border-border glow-gold">
              <CardHeader>
                <CardTitle className="font-display">Resumen del turno</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium">{selectedServiceData?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Barbero</span>
                  <span className="font-medium">{barbers?.find((b) => b.id === selectedBarber)?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Precio</span>
                  <span className="text-primary font-bold text-xl">${selectedServiceData?.price.toLocaleString("es-AR")}</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>← Atrás</Button>
              <Button className="flex-1" onClick={handleBook} disabled={submitting}>
                {submitting ? "Reservando..." : "Confirmar Reserva"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
