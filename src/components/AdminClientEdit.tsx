import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREQ_OPTIONS = [
  { value: "none", label: "No frecuente" },
  { value: "7", label: "Cada 7 días" },
  { value: "15", label: "Cada 15 días" },
  { value: "30", label: "Cada 30 días" },
];

export default function AdminClientEdit({ client, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(client.full_name || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [notes, setNotes] = useState(client.permanent_notes || "");
  const [freq, setFreq] = useState<string>(client.visit_frequency_days ? String(client.visit_frequency_days) : "none");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          permanent_notes: notes || null,
          visit_frequency_days: freq === "none" ? null : parseInt(freq, 10),
        })
        .eq("user_id", client.user_id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin_clients"] });
      toast({ title: "Ficha actualizada" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Ficha de cliente</DialogTitle>
          <DialogDescription>Editá la información permanente del cliente</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+54 11 ..." />
          </div>
          <div className="space-y-2">
            <Label>Notas permanentes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Preferencias, alergias, tipo de corte habitual, etc."
            />
          </div>
          <div className="space-y-2">
            <Label>Frecuencia habitual de visita</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
