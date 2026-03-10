import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyColorsToDOM } from "@/components/AdminColorPanel";

/**
 * Loads saved theme colors from shop_settings and applies them as CSS variables.
 * Renders nothing — just a side-effect component.
 */
export default function ThemeLoader() {
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("shop_settings")
        .select("value")
        .eq("key", "theme_colors")
        .maybeSingle();
      if (data?.value && typeof data.value === "object") {
        applyColorsToDOM(data.value as Record<string, string>);
      }
    };
    load();
  }, []);

  return null;
}
