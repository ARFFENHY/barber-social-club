import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopSettings } from "@/hooks/useShopData";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Image, Type, Building2, Upload, Trash2, Save, Loader2, Plus, X,
} from "lucide-react";

const BUCKET = "shop_images";

function ImageUploader({
  label,
  settingKey,
  currentUrl,
  onSaved,
}: {
  label: string;
  settingKey: string;
  currentUrl?: string;
  onSaved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${settingKey}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await upsertSetting(settingKey, urlData.publicUrl);
      setPreview(urlData.publicUrl);
      onSaved();
      toast({ title: `${label} actualizado` });
    } catch (e: any) {
      toast({ title: "Error al subir imagen", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    await upsertSetting(settingKey, "");
    setPreview(null);
    onSaved();
    toast({ title: `${label} eliminado` });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {preview ? (
        <div className="relative w-full max-w-xs">
          <img src={preview} alt={label} className="w-full h-40 object-cover rounded-lg border border-border" />
          <div className="absolute top-2 right-2 flex gap-1">
            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={remove}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full max-w-xs h-40 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          <span className="text-xs">Subir imagen</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}

function GalleryManager({ images, onSaved }: { images: string[]; onSaved: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `gallery/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const updated = [...images, urlData.publicUrl];
      await upsertSetting("gallery_images", JSON.stringify(updated));
      onSaved();
      toast({ title: "Imagen agregada a la galería" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    await upsertSetting("gallery_images", JSON.stringify(updated));
    onSaved();
    toast({ title: "Imagen eliminada de la galería" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Galería ({images.length} imágenes)</Label>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Agregar
        </Button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.map((img, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
            <img src={img} alt={`Galería ${i + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => remove(i)}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}

async function upsertSetting(key: string, value: any) {
  const jsonValue = typeof value === "string" ? value : JSON.stringify(value);
  const { data: existing } = await supabase.from("shop_settings").select("id").eq("key", key).maybeSingle();
  if (existing) {
    await supabase.from("shop_settings").update({ value: jsonValue }).eq("key", key);
  } else {
    await supabase.from("shop_settings").insert({ key, value: jsonValue });
  }
}

function TextsSection({ settings }: { settings: Record<string, any> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [aboutHistory, setAboutHistory] = useState("");
  const [aboutTeam, setAboutTeam] = useState("");

  useEffect(() => {
    setHeroTitle(settings.hero_title || "Tu Estilo, Nuestro Arte");
    setHeroSubtitle(settings.hero_subtitle || "Reservá tu turno en segundos. Cortes profesionales con Nacho y Nestor.");
    setAboutText(settings.about_text || "");
    setAboutHistory(settings.about_history || "");
    setAboutTeam(settings.about_team || "");
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertSetting("hero_title", heroTitle),
        upsertSetting("hero_subtitle", heroSubtitle),
        upsertSetting("about_text", aboutText),
        upsertSetting("about_history", aboutHistory),
        upsertSetting("about_team", aboutTeam),
      ]);
      queryClient.invalidateQueries({ queryKey: ["shop_settings"] });
      toast({ title: "Textos guardados" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gradient-gold">
          <Type className="w-5 h-5 text-primary" /> Textos del Sitio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hero / Portada</h4>
          <div className="space-y-2">
            <Label>Título principal</Label>
            <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Sección Nosotros</h4>
          <div className="space-y-2">
            <Label>Presentación</Label>
            <Textarea rows={3} value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Texto de presentación de la barbería..." />
          </div>
          <div className="space-y-2">
            <Label>Historia del negocio</Label>
            <Textarea rows={3} value={aboutHistory} onChange={(e) => setAboutHistory(e.target.value)} placeholder="Historia de la barbería..." />
          </div>
          <div className="space-y-2">
            <Label>Descripción del equipo</Label>
            <Textarea rows={3} value={aboutTeam} onChange={(e) => setAboutTeam(e.target.value)} placeholder="Descripción del equipo..." />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Textos
        </Button>
      </CardContent>
    </Card>
  );
}

function BusinessInfoSection({ settings }: { settings: Record<string, any> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [scheduleWeek, setScheduleWeek] = useState("");
  const [scheduleWeekend, setScheduleWeekend] = useState("");

  useEffect(() => {
    setAddress(settings.business_address || "Buenos Aires 5075 entre Lavalle y General Paz");
    setWhatsapp(settings.business_whatsapp || "5491170055858");
    setInstagram(settings.business_instagram || "barber.social.club");
    setScheduleWeek(settings.schedule_weekdays || "Martes a Jueves: 10:00 a 13:00 · 16:00 a 20:00");
    setScheduleWeekend(settings.schedule_weekend || "Viernes y Sábado: 10:00 a 20:00");
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertSetting("business_address", address),
        upsertSetting("business_whatsapp", whatsapp),
        upsertSetting("business_instagram", instagram),
        upsertSetting("schedule_weekdays", scheduleWeek),
        upsertSetting("schedule_weekend", scheduleWeekend),
      ]);
      queryClient.invalidateQueries({ queryKey: ["shop_settings"] });
      toast({ title: "Información guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gradient-gold">
          <Building2 className="w-5 h-5 text-primary" /> Información del Negocio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Dirección</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>WhatsApp (número completo, ej: 5491170055858)</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Instagram (usuario sin @)</Label>
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </div>
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Horarios</h4>
          <div className="space-y-2">
            <Label>Horario entre semana</Label>
            <Input value={scheduleWeek} onChange={(e) => setScheduleWeek(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horario fin de semana</Label>
            <Input value={scheduleWeekend} onChange={(e) => setScheduleWeekend(e.target.value)} />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Información
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminContentManager() {
  const { data: settings } = useShopSettings();
  const queryClient = useQueryClient();
  const s = settings || {};

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shop_settings"] });

  let galleryImages: string[] = [];
  try {
    const raw = s.gallery_images;
    if (typeof raw === "string") galleryImages = JSON.parse(raw);
    else if (Array.isArray(raw)) galleryImages = raw;
  } catch {}

  return (
    <Tabs defaultValue="images" className="space-y-6">
      <TabsList className="bg-muted flex-wrap h-auto gap-1">
        <TabsTrigger value="images"><Image className="w-4 h-4 mr-1" />Imágenes</TabsTrigger>
        <TabsTrigger value="texts"><Type className="w-4 h-4 mr-1" />Textos</TabsTrigger>
        <TabsTrigger value="business"><Building2 className="w-4 h-4 mr-1" />Información</TabsTrigger>
      </TabsList>

      <TabsContent value="images">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gradient-gold">
              <Image className="w-5 h-5 text-primary" /> Gestión de Imágenes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <ImageUploader label="Logo de la barbería" settingKey="logo_url" currentUrl={s.logo_url} onSaved={refresh} />
              <ImageUploader label="Imagen Hero / Portada" settingKey="hero_image_url" currentUrl={s.hero_image_url} onSaved={refresh} />
            </div>
            <div className="border-t border-border pt-6">
              <GalleryManager images={galleryImages} onSaved={refresh} />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="texts">
        <TextsSection settings={s} />
      </TabsContent>

      <TabsContent value="business">
        <BusinessInfoSection settings={s} />
      </TabsContent>
    </Tabs>
  );
}
