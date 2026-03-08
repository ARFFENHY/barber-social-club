import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServices } from "@/hooks/useShopData";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Clock, DollarSign } from "lucide-react";

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
}

const emptyForm: ServiceForm = { name: "", description: "", price: "", duration_minutes: "30" };

export default function AdminServices() {
  const { data: services, isLoading } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null); // service id or "new"
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(emptyForm);
    setEditing("new");
  };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      description: s.description || "",
      price: String(s.price),
      duration_minutes: String(s.duration_minutes),
    });
    setEditing(s.id);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.duration_minutes) {
      toast({ title: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        duration_minutes: parseInt(form.duration_minutes),
      };

      if (editing === "new") {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
        toast({ title: "Servicio creado" });
      } else {
        const { error } = await supabase.from("services").update(payload).eq("id", editing!);
        if (error) throw error;
        toast({ title: "Servicio actualizado" });
      }

      queryClient.invalidateQueries({ queryKey: ["services"] });
      setEditing(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").update({ is_active: false }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Servicio eliminado" });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-gradient-gold">Gestión de Servicios</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm text-center py-4">Cargando...</p>
        ) : services?.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No hay servicios.</p>
        ) : (
          <div className="space-y-3">
            {services?.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-primary" />${s.price.toLocaleString("es-AR")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" />{s.duration_minutes} min
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar "{s.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>El servicio dejará de estar disponible para nuevas reservas. Las citas existentes no se verán afectadas.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing === "new" ? "Nuevo servicio" : "Editar servicio"}</DialogTitle>
            <DialogDescription>Completá los datos del servicio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Corte" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve del servicio" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio ($) *</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="20000" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Duración (min) *</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="30" min="5" step="5" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
