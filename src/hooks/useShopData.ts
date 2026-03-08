import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBarbers() {
  return useQuery({
    queryKey: ["barbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useShopSettings() {
  return useQuery({
    queryKey: ["shop_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("*");
      if (error) throw error;
      const settings: Record<string, any> = {};
      data?.forEach((s) => {
        settings[s.key] = s.value;
      });
      return settings;
    },
  });
}

export function useAppointments(date?: string, barberId?: string) {
  return useQuery({
    queryKey: ["appointments", date, barberId],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*, barbers(name), services(name, duration_minutes, price)")
        .neq("status", "cancelled")
        .order("time");
      if (date) query = query.eq("date", date);
      if (barberId) query = query.eq("barber_id", barberId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!date || !!barberId,
  });
}

export function useBlockedSlots(date?: string) {
  return useQuery({
    queryKey: ["blocked_slots", date],
    queryFn: async () => {
      let query = supabase.from("blocked_slots").select("*");
      if (date) query = query.eq("date", date);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMyAppointments(userId?: string) {
  return useQuery({
    queryKey: ["my_appointments", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name, price)")
        .eq("user_id", userId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
