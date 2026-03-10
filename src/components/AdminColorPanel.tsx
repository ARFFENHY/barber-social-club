import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save, RotateCcw, Palette } from "lucide-react";

interface ThemeColors {
  "color-primary": string;
  "color-secondary": string;
  "color-background": string;
  "color-text": string;
  "color-text-secondary": string;
  "color-button": string;
  "color-button-hover": string;
  "color-link": string;
  "color-border": string;
  "color-success": string;
  "color-warning": string;
  "color-error": string;
}

const DEFAULT_COLORS: ThemeColors = {
  "color-primary": "#d4a017",
  "color-secondary": "#1f1a14",
  "color-background": "#0f0b07",
  "color-text": "#ede5d8",
  "color-text-secondary": "#8a7e6e",
  "color-button": "#d4a017",
  "color-button-hover": "#b8860b",
  "color-link": "#d4a017",
  "color-border": "#2e2820",
  "color-success": "#22c55e",
  "color-warning": "#eab308",
  "color-error": "#ef4444",
};

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  "color-primary": "Color primario",
  "color-secondary": "Color secundario",
  "color-background": "Color de fondo",
  "color-text": "Texto principal",
  "color-text-secondary": "Texto secundario",
  "color-button": "Botones",
  "color-button-hover": "Botones (hover)",
  "color-link": "Enlaces",
  "color-border": "Bordes",
  "color-success": "Estado: éxito",
  "color-warning": "Estado: advertencia",
  "color-error": "Estado: error",
};

const COLOR_GROUPS = [
  { title: "Colores principales", keys: ["color-primary", "color-secondary", "color-background"] as (keyof ThemeColors)[] },
  { title: "Texto", keys: ["color-text", "color-text-secondary"] as (keyof ThemeColors)[] },
  { title: "Interacción", keys: ["color-button", "color-button-hover", "color-link", "color-border"] as (keyof ThemeColors)[] },
  { title: "Estados", keys: ["color-success", "color-warning", "color-error"] as (keyof ThemeColors)[] },
];

export default function AdminColorPanel() {
  const [colors, setColors] = useState<ThemeColors>({ ...DEFAULT_COLORS });
  const [savedColors, setSavedColors] = useState<ThemeColors>({ ...DEFAULT_COLORS });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadColors();
  }, []);

  const loadColors = async () => {
    const { data } = await supabase
      .from("shop_settings")
      .select("value")
      .eq("key", "theme_colors")
      .maybeSingle();
    if (data?.value && typeof data.value === "object") {
      const merged = { ...DEFAULT_COLORS, ...(data.value as Partial<ThemeColors>) };
      setColors(merged);
      setSavedColors(merged);
    }
  };

  const handleChange = (key: keyof ThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("shop_settings")
        .select("id")
        .eq("key", "theme_colors")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("shop_settings")
          .update({ value: colors as any })
          .eq("key", "theme_colors");
      } else {
        await supabase
          .from("shop_settings")
          .insert({ key: "theme_colors", value: colors as any });
      }

      setSavedColors({ ...colors });
      // Apply immediately
      applyColorsToDOM(colors as unknown as Record<string, string>);
      toast({ title: "Colores guardados", description: "Los cambios se aplicaron correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los colores.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setColors({ ...DEFAULT_COLORS });
  };

  const hasChanges = JSON.stringify(colors) !== JSON.stringify(savedColors);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Colores del tema</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading || !hasChanges}>
            <Save className="w-4 h-4 mr-1" /> {loading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {COLOR_GROUPS.map((group) => (
        <Card key={group.title} className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{group.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.keys.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <label
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: colors[key] }}
                  >
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground">{COLOR_LABELS[key]}</Label>
                    <Input
                      value={colors[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="h-7 text-xs font-mono mt-0.5"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Preview */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vista previa</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg p-6 space-y-4 border"
            style={{
              backgroundColor: colors["color-background"],
              borderColor: colors["color-border"],
            }}
          >
            <h4 style={{ color: colors["color-text"], fontFamily: "Playfair Display, serif", fontSize: "1.25rem" }}>
              Título de ejemplo
            </h4>
            <p style={{ color: colors["color-text-secondary"], fontSize: "0.875rem" }}>
              Este es un texto secundario de ejemplo para previsualizar cómo se verán los colores en la aplicación.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-4 py-2 rounded-md text-sm font-semibold transition-colors"
                style={{ backgroundColor: colors["color-button"], color: colors["color-background"] }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors["color-button-hover"])}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors["color-button"])}
              >
                Botón primario
              </button>
              <button
                className="px-4 py-2 rounded-md text-sm font-semibold border"
                style={{
                  backgroundColor: "transparent",
                  color: colors["color-primary"],
                  borderColor: colors["color-primary"],
                }}
              >
                Botón outline
              </button>
            </div>
            <div className="flex gap-3 text-sm">
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: colors["color-link"], textDecoration: "underline" }}>
                Enlace de ejemplo
              </a>
            </div>
            <div
              className="rounded-lg p-3 border"
              style={{ backgroundColor: colors["color-secondary"], borderColor: colors["color-border"] }}
            >
              <p style={{ color: colors["color-text"], fontSize: "0.875rem" }}>Card de ejemplo</p>
              <p style={{ color: colors["color-text-secondary"], fontSize: "0.75rem" }}>Contenido dentro de una card</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors["color-success"] + "30", color: colors["color-success"] }}>
                Éxito
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors["color-warning"] + "30", color: colors["color-warning"] }}>
                Advertencia
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors["color-error"] + "30", color: colors["color-error"] }}>
                Error
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Convert hex color to HSL string (without hsl() wrapper) for Tailwind CSS vars */
function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  r = parseInt(hex.substring(0, 2), 16) / 255;
  g = parseInt(hex.substring(2, 4), 16) / 255;
  b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Mapping from panel color keys to Tailwind CSS variable names */
const COLOR_TO_CSS_MAP: Record<string, string[]> = {
  "color-primary": ["--primary", "--ring", "--sidebar-primary", "--gold"],
  "color-secondary": ["--secondary", "--sidebar-accent"],
  "color-background": ["--background", "--sidebar-background"],
  "color-text": ["--foreground", "--card-foreground", "--popover-foreground", "--sidebar-foreground"],
  "color-text-secondary": ["--muted-foreground", "--secondary-foreground"],
  "color-button": ["--primary", "--gold"],
  "color-button-hover": ["--gold-dark", "--accent"],
  "color-link": ["--gold-light"],
  "color-border": ["--border", "--input", "--sidebar-border"],
  "color-success": [],
  "color-warning": [],
  "color-error": ["--destructive"],
};

/** Apply custom theme colors as CSS variables on :root */
export function applyColorsToDOM(colors: Partial<Record<string, string>>) {
  const root = document.documentElement;
  const applied = new Set<string>();

  Object.entries(colors).forEach(([key, value]) => {
    if (!value) return;
    // Set the raw custom variable
    root.style.setProperty(`--${key}`, value);

    // Map to Tailwind CSS variables (HSL)
    const hsl = hexToHSL(value);
    const targets = COLOR_TO_CSS_MAP[key];
    if (targets) {
      targets.forEach((cssVar) => {
        if (!applied.has(cssVar)) {
          root.style.setProperty(cssVar, hsl);
          applied.add(cssVar);
        }
      });
    }
  });

  // Derive card/popover from background if set
  if (colors["color-background"]) {
    const bgHsl = hexToHSL(colors["color-background"]);
    const parts = bgHsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (parts) {
      const [, h, s, l] = parts.map(Number);
      const cardL = Math.min(l + 4, 100);
      const cardHsl = `${h} ${s}% ${cardL}%`;
      if (!applied.has("--card")) root.style.setProperty("--card", cardHsl);
      if (!applied.has("--popover")) root.style.setProperty("--popover", cardHsl);
      const mutedL = Math.min(l + 8, 100);
      root.style.setProperty("--muted", `${h} ${Math.max(s - 2, 0)}% ${mutedL}%`);
    }
  }

  // Derive primary-foreground from background
  if (colors["color-background"]) {
    root.style.setProperty("--primary-foreground", hexToHSL(colors["color-background"]));
    root.style.setProperty("--sidebar-primary-foreground", hexToHSL(colors["color-background"]));
  }
}
