import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbers } from "@/hooks/useShopData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type ScheduleBlock = { start: string; end: string };
type DaySchedule = { enabled: boolean; blocks: ScheduleBlock[] };
type WeekSchedule = Record<number, DaySchedule>;
type BarberDays = Record<string, number[]>;

const DEFAULT_WEEK: WeekSchedule = {
  0: { enabled: false, blocks: [{ start: "10:00", end: "20:00" }] },
  1: { enabled: false, blocks: [{ start: "10:00", end: "20:00" }] },
  2: { enabled: true, blocks: [{ start: "10:00", end: "13:00" }, { start: "16:00", end: "20:00" }] },
  3: { enabled: true, blocks: [{ start: "10:00", end: "13:00" }, { start: "16:00", end: "20:00" }] },
  4: { enabled: true, blocks: [{ start: "10:00", end: "13:00" }, { start: "16:00", end: "20:00" }] },
  5: { enabled: true, blocks: [{ start: "10:00", end: "20:00" }] },
  6: { enabled: true, blocks: [{ start: "10:00", end: "20:00" }] },
};

function parseSettingsToWeek(settings: any): WeekSchedule {
  if (!settings?.working_hours?.schedules) return DEFAULT_WEEK;
  const week: WeekSchedule = {};
  for (let d = 0; d < 7; d++) {
    week[d] = { enabled: false, blocks: [{ start: "10:00", end: "20:00" }] };
  }
  for (const sched of settings.working_hours.schedules) {
    for (const day of sched.days) {
      week[day] = { enabled: true, blocks: sched.blocks.map((b: any) => ({ start: b.start, end: b.end })) };
    }
  }
  return week;
}

function weekToSettings(week: WeekSchedule) {
  // Group days with identical blocks
  const groups: { days: number[]; blocks: ScheduleBlock[] }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!week[d].enabled) continue;
    const blocksKey = JSON.stringify(week[d].blocks);
    const existing = groups.find((g) => JSON.stringify(g.blocks) === blocksKey);
    if (existing) {
      existing.days.push(d);
    } else {
      groups.push({ days: [d], blocks: [...week[d].blocks] });
    }
  }
  return { schedules: groups };
}

export default function AdminScheduleSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: barbers } = useBarbers();
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["shop_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_settings").select("*");
      if (error) throw error;
      const s: Record<string, any> = {};
      data?.forEach((r) => { s[r.key] = r.value; });
      return s;
    },
  });

  const [week, setWeek] = useState<WeekSchedule>(DEFAULT_WEEK);
  const [barberDays, setBarberDays] = useState<BarberDays>({});
  const [slotDuration, setSlotDuration] = useState(30);

  useEffect(() => {
    if (settings) {
      setWeek(parseSettingsToWeek(settings));
      setBarberDays(settings.barber_schedules || {});
      setSlotDuration(settings.slot_duration?.minutes || 30);
    }
  }, [settings]);

  const toggleDay = (day: number) => {
    setWeek((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateBlock = (day: number, blockIdx: number, field: "start" | "end", value: string) => {
    setWeek((prev) => {
      const blocks = [...prev[day].blocks];
      blocks[blockIdx] = { ...blocks[blockIdx], [field]: value };
      return { ...prev, [day]: { ...prev[day], blocks } };
    });
  };

  const addBlock = (day: number) => {
    setWeek((prev) => ({
      ...prev,
      [day]: { ...prev[day], blocks: [...prev[day].blocks, { start: "14:00", end: "18:00" }] },
    }));
  };

  const removeBlock = (day: number, blockIdx: number) => {
    setWeek((prev) => {
      const blocks = prev[day].blocks.filter((_, i) => i !== blockIdx);
      return { ...prev, [day]: { ...prev[day], blocks: blocks.length ? blocks : [{ start: "10:00", end: "20:00" }] } };
    });
  };

  const toggleBarberDay = (barberId: string, day: number) => {
    setBarberDays((prev) => {
      const days = prev[barberId] || [];
      const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
      return { ...prev, [barberId]: newDays };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const workingHours = weekToSettings(week);

      await Promise.all([
        supabase.from("shop_settings").upsert({ key: "working_hours", value: workingHours }, { onConflict: "key" }),
        supabase.from("shop_settings").upsert({ key: "barber_schedules", value: barberDays }, { onConflict: "key" }),
        supabase.from("shop_settings").upsert({ key: "slot_duration", value: { minutes: slotDuration } }, { onConflict: "key" }),
      ]);

      queryClient.invalidateQueries({ queryKey: ["shop_settings"] });
      toast({ title: "Configuración guardada" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const enabledDays = Object.entries(week).filter(([, v]) => v.enabled).map(([k]) => Number(k));

  return (
    <div className="space-y-6">
      {/* Slot duration */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Duración del turno</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={10}
              max={120}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
        </CardContent>
      </Card>

      {/* Working days & hours */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Días y horarios de atención</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <div key={day} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Switch checked={week[day].enabled} onCheckedChange={() => toggleDay(day)} />
                  <span className={`font-medium ${week[day].enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {DAY_NAMES[day]}
                  </span>
                </div>
                {week[day].enabled && week[day].blocks.length < 3 && (
                  <Button variant="ghost" size="sm" onClick={() => addBlock(day)} className="text-xs text-primary">
                    + Bloque
                  </Button>
                )}
              </div>
              {week[day].enabled && (
                <div className="pl-10 space-y-2">
                  {week[day].blocks.map((block, bi) => (
                    <div key={bi} className="flex items-center gap-2">
                      <Input type="time" value={block.start} onChange={(e) => updateBlock(day, bi, "start", e.target.value)} className="w-28" />
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input type="time" value={block.end} onChange={(e) => updateBlock(day, bi, "end", e.target.value)} className="w-28" />
                      {week[day].blocks.length > 1 && (
                        <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removeBlock(day, bi)}>✕</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Barber schedules */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Días de trabajo por barbero</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {barbers?.map((barber) => (
            <div key={barber.id}>
              <p className="font-medium mb-2">{barber.name}</p>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const isBarberDay = (barberDays[barber.id] || []).includes(day);
                  const isDayEnabled = enabledDays.includes(day);
                  return (
                    <button
                      key={day}
                      disabled={!isDayEnabled}
                      onClick={() => toggleBarberDay(barber.id, day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        !isDayEnabled
                          ? "border-border text-muted-foreground/30 cursor-not-allowed"
                          : isBarberDay
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {DAY_NAMES[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Guardando..." : "Guardar configuración"}
      </Button>
    </div>
  );
}
